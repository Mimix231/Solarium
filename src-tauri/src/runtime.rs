//! Solarium-managed runtimes are installed alongside the development project or portable executable.
//! This deliberately avoids Tauri's per-user application-data location for large downloads.
use std::fs;
use std::path::PathBuf;

pub fn runtime_dir() -> Result<PathBuf, String> {
    let base = if cfg!(debug_assertions) {
        // Cargo's working directory varies between `tauri dev` and `cargo run`.
        // CARGO_MANIFEST_DIR reliably points to `<project>/src-tauri`.
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent().ok_or("Cannot resolve the Solarium project directory")?.to_path_buf()
    } else {
        // Portable builds: never trust the launcher's current working directory.
        std::env::current_exe().map_err(|e| e.to_string())?
            .parent().ok_or("Cannot locate the Solarium executable")?.to_path_buf()
    };
    Ok(base.join("runtime"))
}

pub fn ensure_runtime_dir() -> Result<PathBuf, String> {
    let dir = runtime_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!(
        "Cannot create {}: {e}. Run Solarium from a writable, portable folder (not Program Files).", dir.display()
    ))?;
    // Fail immediately if the parent of `runtime/` isn't writable, rather than after a large download.
    let probe = dir.join(format!(".writable-{}", std::process::id()));
    fs::write(&probe, []).map_err(|e| format!(
        "Runtime folder {} is not writable: {e}. Move Solarium to a writable folder.", dir.display()
    ))?;
    let _ = fs::remove_file(probe);
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn runtime_is_relative_to_solarium_and_never_appdata() {
        let path = runtime_dir().unwrap();
        assert_eq!(path.file_name().unwrap(), "runtime");
        assert!(!path.to_string_lossy().contains("solarium-vllm"));
    }
}
