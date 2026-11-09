use crate::{creator::safe_root, project_commands::register_cancellation, project_snapshot::snapshot};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::atomic::Ordering,
    time::{Duration, Instant},
};

fn executable(root: &Path) -> Result<PathBuf, String> {
    let name = if cfg!(windows) { "spica-app.exe" } else { "spica-app" };
    let expected = root.join("src-tauri").join("target").join("debug").join(name);
    let path = expected.canonicalize().map_err(|error| format!("SPICA executable unavailable: {error}"))?;
    if path != expected || !fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.is_file()) {
        return Err("The SPICA executable must be a regular build output inside the linked project.".into());
    }
    Ok(path)
}

fn open_executable(path: &Path) -> io::Result<File> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // Keep the verified image from being replaced between hashing and spawn.
        options.share_mode(1);
    }
    options.open(path)
}

fn executable_hash(mut file: &File) -> Result<String, String> {
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let size = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if size == 0 { break; }
        hash.update(&buffer[..size]);
    }
    Ok(format!("{:x}", hash.finalize()))
}

#[tauri::command]
pub async fn spica_executable_hash(root: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = executable(&safe_root(&root)?)?;
        executable_hash(&open_executable(&path).map_err(|error| error.to_string())?)
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn launch_spica_app(root: String, source: String, executable_sha: String) -> Result<u32, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = safe_root(&root)?;
        if snapshot(&root)?.sha256 != source {
            return Err("Project source changed after verification. Test the current export again.".into());
        }
        let path = executable(&root)?;
        let file = open_executable(&path).map_err(|error| error.to_string())?;
        if executable_hash(&file)? != executable_sha {
            return Err("The SPICA executable changed after verification. Build it again.".into());
        }
        let mut command = Command::new(&path);
        command.current_dir(&root).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        // The built app opens its normal window. Solarium's dev inspection port
        // and profile belong to Solarium's WebView, not to the child app.
        command.env_remove("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").env_remove("WEBVIEW2_USER_DATA_FOLDER");
        let mut child = command.spawn().map_err(|error| format!("Could not launch the SPICA app: {error}"))?;
        let pid = child.id();
        std::thread::spawn(move || { let _ = child.wait(); });
        Ok(pid)
    }).await.map_err(|error| error.to_string())?
}

struct ScenarioDirectory { parent: PathBuf, path: PathBuf }
impl Drop for ScenarioDirectory {
    fn drop(&mut self) {
        if self.path.parent() == Some(self.parent.as_path()) && self.path.canonicalize().ok().as_ref() == Some(&self.path) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

#[tauri::command]
pub async fn run_spica_scenario(root: String, source: String, executable_sha: String, run_id: String,
    scenario: String, reopen: bool) -> Result<Vec<Value>, String> {
    if run_id.len() != 32 || !run_id.bytes().all(|byte| byte.is_ascii_hexdigit()) || scenario.is_empty() || scenario.len() > 40 ||
        !scenario.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_') {
        return Err("Invalid SPICA scenario identity.".into());
    }
    let root = safe_root(&root)?;
    let cancellation = register_cancellation(&root, &run_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        if snapshot(&root)?.sha256 != source { return Err("Source changed before the runtime test.".into()); }
        let path = executable(&root)?;
        let file = open_executable(&path).map_err(|error| error.to_string())?;
        if executable_hash(&file)? != executable_sha { return Err("The test executable differs from the build receipt.".into()); }
        let parent = std::env::temp_dir().canonicalize().map_err(|error| error.to_string())?;
        let dir = ScenarioDirectory { path: parent.join(format!("spica-run-{run_id}")), parent };
        // If this directory already exists it does not belong to the run.
        if let Err(error) = fs::create_dir(&dir.path) {
            std::mem::forget(dir);
            return Err(format!("Could not allocate a scenario fixture: {error}"));
        }
        let mut reports = Vec::new();
        let phases = if reopen { &(["initial", "reopen"])[..] } else { &(["initial"])[..] };
        for phase in phases {
            if cancellation.flag.load(Ordering::SeqCst) { return Err("Scenario stopped.".into()); }
            let mut command = Command::new(&path);
            crate::project_commands::clean_environment(&mut command);
            command.current_dir(&root).args(["--spica-scenario", &run_id, &scenario, phase])
                .env_remove("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").env("WEBVIEW2_USER_DATA_FOLDER", dir.path.join("webview"))
                .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::from(File::create(dir.path.join("stderr")).map_err(|e| e.to_string())?));
            #[cfg(windows)] let job = crate::windows_job::JobObject::create()?;
            let mut child = command.spawn().map_err(|error| format!("Could not start test app: {error}"))?;
            #[cfg(windows)] if let Err(error) = job.attach(&child) { let _ = child.kill(); let _ = child.wait(); return Err(error); }
            let started = Instant::now();
            let status = loop {
                if let Some(status) = child.try_wait().map_err(|e| e.to_string())? { break status; }
                if cancellation.flag.load(Ordering::SeqCst) || started.elapsed() > Duration::from_secs(60) {
                    let _ = child.kill(); let _ = child.wait();
                    return Err(if cancellation.flag.load(Ordering::SeqCst) { "Scenario stopped." } else { "The app did not report a scenario result within 60 seconds." }.into());
                }
                std::thread::sleep(Duration::from_millis(40));
            };
            #[cfg(windows)] drop(job);
            if !status.success() {
                let diagnostic = fs::read_to_string(dir.path.join("stderr")).unwrap_or_default();
                return Err(format!("Test app exited with {status}. {}", diagnostic.chars().take(1500).collect::<String>()));
            }
            let result = dir.path.join(format!("{phase}.json"));
            if !result.symlink_metadata().is_ok_and(|metadata| metadata.is_file() && metadata.len() <= 120_000) {
                return Err("The test app did not write a valid scenario report.".into());
            }
            let report: Value = serde_json::from_slice(&fs::read(result).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            if report["id"] != scenario || report["phase"] != *phase || !matches!(report["state"].as_str(), Some("passed" | "failed")) {
                return Err("The test app returned mismatched scenario evidence.".into());
            }
            let passed = report["state"] == "passed";
            reports.push(report);
            if !passed { break; }
        }
        if snapshot(&root)?.sha256 != source { return Err("Source changed during the runtime test.".into()); }
        Ok(reports)
    }).await.map_err(|error| error.to_string())?
}
