//! Native installation jobs outlive React views. State snapshots are kept in
//! <runtime>/installer/jobs.json, including interrupted-job recovery.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallJob {
    pub id: String,
    pub engine: String,
    pub status: String,
    pub phase: String,
    pub downloaded: u64,
    pub total: u64,
    pub updated_at: u64,
    pub result: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone)]
pub struct InstallJobs {
    inner: Arc<Mutex<Vec<InstallJob>>>,
    cancellations: Arc<Mutex<HashSet<String>>>,
    path: PathBuf,
}
fn timestamp() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }
impl InstallJobs {
    pub fn new(path: PathBuf) -> Self {
        let mut jobs: Vec<InstallJob> = fs::read(&path).ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default();
        for job in &mut jobs {
            if job.status == "running" || job.status == "cancelling" {
                job.status = "interrupted".into();
                job.phase = "Solarium closed before the installation completed; retry to continue.".into();
                job.updated_at = timestamp();
            }
        }
        let state = Self { inner: Arc::new(Mutex::new(jobs)), cancellations: Arc::new(Mutex::new(HashSet::new())), path };
        state.save();
        state
    }
    fn save(&self) {
        let Ok(jobs) = self.inner.lock() else { return; };
        if let Some(parent) = self.path.parent() { let _ = fs::create_dir_all(parent); }
        if let Ok(data) = serde_json::to_vec_pretty(&*jobs) {
            let temp = self.path.with_extension("tmp");
            if fs::write(&temp, data).is_ok() {
                // On Windows std::fs::rename cannot replace an existing file.
                if fs::rename(&temp, &self.path).is_err() {
                    let _ = fs::remove_file(&self.path);
                    let _ = fs::rename(&temp, &self.path);
                }
            }
        }
    }
    pub fn list(&self) -> Vec<InstallJob> { self.inner.lock().map(|v| v.clone()).unwrap_or_default() }
    /// Update persisted historical install paths after migrating the numbered
    /// llama.cpp folder. The completed binary's location must stay accurate.
    pub fn repoint_completed_llama_results(&self, runtime: &Path, server: &Path) {
        let Ok(mut jobs) = self.inner.lock() else { return; };
        let mut changed = false;
        for job in jobs.iter_mut() {
            if job.engine == "llama.cpp" && job.status == "completed" && job.result.as_deref()
                .is_some_and(|p| Path::new(p).starts_with(runtime.join("engines"))) {
                job.result = Some(server.to_string_lossy().into_owned());
                changed = true;
            }
        }
        drop(jobs);
        if changed { self.save(); }
    }

    pub fn begin(&self, engine: &str) -> Result<String, String> {
        let mut jobs = self.inner.lock().map_err(|_| "Installer state is locked")?;
        if jobs.iter().any(|j| j.engine == engine && (j.status == "running" || j.status == "cancelling")) {
            return Err(format!("{engine} already has an active installation job."));
        }
        let id = format!("{}-{}", engine.replace('.', "-"),
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos());
        jobs.push(InstallJob { id: id.clone(), engine: engine.into(), status: "running".into(),
            phase: "Queued".into(), downloaded: 0, total: 0, updated_at: timestamp(), result: None, error: None });
        drop(jobs);
        self.save();
        Ok(id)
    }
    pub fn progress(&self, app: &AppHandle, id: &str, phase: &str, downloaded: u64, total: u64) {
        self.change(app, id, |j| { j.phase = phase.into(); j.downloaded = downloaded; j.total = total; });
    }
    pub fn cancellation_requested(&self, id: &str) -> bool {
        self.cancellations.lock().map(|ids| ids.contains(id)).unwrap_or(false)
    }
    pub fn request_cancel(&self, app: &AppHandle, id: &str) -> Result<(), String> {
        let job = self.list().into_iter().find(|job| job.id == id).ok_or("No installation job with this ID")?;
        if job.status != "running" { return Err("This installation is not running".into()); }
        self.cancellations.lock().map_err(|_| "Cancellation state locked")?.insert(id.into());
        self.change(app, id, |job| {
            job.status = "cancelling".into();
            job.phase = "Cancellation requested. Waiting for a safe checkpoint…".into();
        });
        Ok(())
    }
    pub fn finish(&self, app: &AppHandle, id: &str, outcome: Result<String, String>) {
        self.change(app, id, |j| match outcome {
            Ok(ref path) => { j.status = "completed".into(); j.phase = "Installed and verified".into(); j.result = Some(path.clone()); j.error = None; },
            Err(ref error) => {
                j.status = if j.status == "cancelling" { "cancelled" } else { "failed" }.into();
                j.phase = if j.status == "cancelled" { "Installation cancelled" } else { "Installation failed" }.into();
                j.error = if j.status == "cancelled" { None } else { Some(error.clone()) };
            },
        });
        if let Ok(mut ids) = self.cancellations.lock() { ids.remove(id); }
    }
    fn change(&self, app: &AppHandle, id: &str, update: impl FnOnce(&mut InstallJob)) {
        let snapshot = {
            let Ok(mut jobs) = self.inner.lock() else { return; };
            let Some(job) = jobs.iter_mut().find(|j| j.id == id) else { return; };
            update(job);
            job.updated_at = timestamp();
            job.clone()
        };
        self.save();
        let _ = app.emit("solarium-install-job", snapshot);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn persisted_active_jobs_are_marked_interrupted() {
        let path = std::env::temp_dir().join(format!("solarium-install-test-{}.json", std::process::id()));
        let jobs = InstallJobs::new(path.clone());
        jobs.begin("llama.cpp").unwrap();
        let restored = InstallJobs::new(path.clone());
        assert_eq!(restored.list()[0].status, "interrupted");
        let _ = fs::remove_file(path);
    }
}
