use crate::{creator::safe_root, project_commands::register_cancellation, project_snapshot::snapshot};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
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

fn file_hash(mut file: &File) -> Result<String, String> {
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
        file_hash(&open_executable(&path).map_err(|error| error.to_string())?)
    }).await.map_err(|error| error.to_string())?
}

fn lock_fingerprints(root: &Path) -> Result<BTreeMap<&'static str, String>, String> {
    ["package-lock.json", "src-tauri/Cargo.lock"].into_iter().map(|relative| {
        let expected = root.join(relative);
        let path = expected.canonicalize().map_err(|error| format!(
            "Cannot read {relative}. Prepare the exported dependencies first. {error}"
        ))?;
        if path != expected || !path.symlink_metadata().is_ok_and(|metadata| metadata.is_file() && metadata.len() <= 8_000_000) {
            return Err(format!("{relative} must be a regular lockfile inside the linked project (up to 8 MB)."));
        }
        let file = open_executable(&path).map_err(|error| error.to_string())?;
        Ok((relative, file_hash(&file)?))
    }).collect()
}

#[tauri::command]
pub async fn spica_lock_fingerprints(root: String) -> Result<BTreeMap<&'static str, String>, String> {
    tauri::async_runtime::spawn_blocking(move || lock_fingerprints(&safe_root(&root)?))
        .await.map_err(|error| error.to_string())?
}

/** The web artifact fingerprint covers every emitted file in dist-web; external symlinks are rejected.
 * Source snapshots deliberately exclude build outputs, so this fingerprint is checked separately.
 */
fn web_artifact_hash(root: &Path) -> Result<String, String> {
    let output = root.join("dist-web");
    if output.canonicalize().map_err(|e| format!("SPICA web build unavailable: {e}"))? != output {
        return Err("SPICA web output must be a real directory directly under the linked project".into());
    }
    let mut stack = vec![output.clone()];
    let mut entries = Vec::new();
    while let Some(dir) = stack.pop() {
        for item in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let item = item.map_err(|e| e.to_string())?;
            let path = item.path();
            let meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
            if meta.file_type().is_symlink() { return Err("SPICA web output contains a symlink".into()); }
            if path.canonicalize().map_err(|e| e.to_string())? != path { return Err("SPICA web output resolves outside its project".into()); }
            if meta.is_dir() { stack.push(path); }
            else if meta.is_file() {
                if meta.len() > 100_000_000 { return Err("SPICA web artifact exceeds the file size limit".into()); }
                entries.push(path);
                if entries.len() > 5000 { return Err("SPICA web artifact contains too many files".into()); }
            }
        }
    }
    if !entries.iter().any(|p| p == &output.join("index.html")) ||
        !entries.iter().any(|p| p.extension().and_then(|s| s.to_str()) == Some("js")) {
        return Err("SPICA web output must include index.html and a compiled JS bundle".into());
    }
    entries.sort();
    let mut hash = Sha256::new();
    for entry in entries {
        let relative = entry.strip_prefix(&output).map_err(|e| e.to_string())?;
        hash.update(relative.to_string_lossy().replace('\\', "/").as_bytes());
        hash.update([0]);
        let file = open_executable(&entry).map_err(|e| e.to_string())?;
        hash.update(file_hash(&file)?.as_bytes());
    }
    Ok(format!("{:x}", hash.finalize()))
}

#[tauri::command]
pub async fn spica_web_artifact_hash(root: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || web_artifact_hash(&safe_root(&root)?))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn spica_web_lock_fingerprints(root: String) -> Result<BTreeMap<&'static str, String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = safe_root(&root)?;
        let expected = root.join("package-lock.json");
        let path = expected.canonicalize().map_err(|e| format!("Prepare web dependencies first: {e}"))?;
        if path != expected || !path.symlink_metadata().is_ok_and(|m| m.is_file() && m.len() <= 8_000_000) {
            return Err("Web package-lock.json must be a regular lockfile under 8 MB".to_string());
        }
        let mut locks = BTreeMap::new();
        locks.insert("package-lock.json", file_hash(&open_executable(&path).map_err(|e| e.to_string())?)?);
        Ok(locks)
    }).await.map_err(|e| e.to_string())?
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
        if file_hash(&file)? != executable_sha {
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
        if file_hash(&file)? != executable_sha { return Err("The test executable differs from the build receipt.".into()); }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spica_locks_are_required_and_hashed_as_project_files() {
        let dir = std::env::temp_dir().join(format!("solarium-spica-locks-{}", std::process::id()));
        fs::create_dir_all(dir.join("src-tauri")).unwrap();
        let root = dir.canonicalize().unwrap();
        fs::write(root.join("package-lock.json"), "{}\n").unwrap();
        assert!(lock_fingerprints(&root).unwrap_err().contains("src-tauri/Cargo.lock"));
        let cargo = root.join("src-tauri/Cargo.lock");
        fs::write(&cargo, "version = 4\n").unwrap();
        let hashes = lock_fingerprints(&root).unwrap();
        assert_eq!(hashes.len(), 2);
        assert_eq!(hashes["src-tauri/Cargo.lock"], format!("{:x}", Sha256::digest(b"version = 4\n")));
        fs::write(&cargo, "version = 4\n\n").unwrap();
        assert_ne!(lock_fingerprints(&root).unwrap(), hashes);
        fs::remove_file(cargo).unwrap();
        fs::remove_file(root.join("package-lock.json")).unwrap();
        fs::remove_dir(root.join("src-tauri")).unwrap();
        fs::remove_dir(root).unwrap();
    }
}
