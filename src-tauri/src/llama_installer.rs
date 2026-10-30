//! Select a compatible upstream llama.cpp Windows bundle from real release assets.
//! GitHub's `/releases/latest` is *stable-only*; nightly Windows assets often
//! exist on prereleases instead, so inspect the releases feed and skip mismatches.
use reqwest::blocking::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Clone, Debug, Deserialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    pub digest: Option<String>,
    pub size: u64,
}
#[derive(Debug, Deserialize)]
pub struct Release {
    pub id: u64,
    pub tag_name: String,
    pub assets: Vec<ReleaseAsset>,
}
#[derive(Debug)]
struct Bundle<'a> {
    release: &'a Release,
    binary: &'a ReleaseAsset,
    runtime: Option<&'a ReleaseAsset>,
}

fn is_windows_archive(name: &str, cuda: bool) -> bool {
    let n = name.to_ascii_lowercase();
    if !n.ends_with(".zip") || !n.contains("win-") || !n.contains("x64") || n.contains("arm64") { return false; }
    if !n.starts_with("llama-") || n.starts_with("llama-src") { return false; }
    if cuda { n.contains("cuda-12") && n.contains("bin-") }
    else { n.contains("win-cpu") && n.contains("bin-") }
}

fn cuda_variant(name: &str) -> Option<&str> {
    let i = name.find("cuda-12")?;
    let suffix = &name[i..];
    suffix.find(".zip").map(|e| &suffix[..e])
}

fn select_bundle(releases: &[Release], cuda: bool) -> Option<Bundle<'_>> {
    for release in releases {
        let binary = release.assets.iter().find(|a| is_windows_archive(&a.name, cuda))?;
        if !cuda { return Some(Bundle { release, binary, runtime: None }); }
        let variant = cuda_variant(&binary.name)?;
        let runtime = release.assets.iter().find(|a| {
            let n = a.name.to_ascii_lowercase();
            n.starts_with("cudart-") && n.ends_with(".zip") && n.contains(variant)
        });
        // Some releases ship only the main bundle. Treat runtime as optional;
        // a missing dependency will be reported by the server startup check.
        return Some(Bundle { release, binary, runtime });
    }
    None
}

fn select_bundle_across_releases(releases: &[Release], cuda: bool) -> Option<Bundle<'_>> {
    releases.iter().find_map(|release| select_bundle(std::slice::from_ref(release), cuda))
}

fn download_verified(client: &Client, asset: &ReleaseAsset, dest: &Path, progress: &impl Fn(&str, u64, u64), cancelled: &impl Fn() -> bool) -> Result<(), String> {
    let expected = asset.digest.as_deref().and_then(|d| d.strip_prefix("sha256:"))
        .filter(|s| s.len() == 64 && s.bytes().all(|c| c.is_ascii_hexdigit()))
        .ok_or_else(|| format!("{} lacks a published SHA-256 digest. Refusing an unverified executable; try an older release or install manually.", asset.name))?;
    if asset.size == 0 || asset.size > 1_200_000_000 { return Err("Release archive has an invalid size (max 1.2 GB).".into()); }
    let url = reqwest::Url::parse(&asset.browser_download_url).map_err(|e| e.to_string())?;
    if url.scheme() != "https" || url.host_str() != Some("github.com") ||
        !url.path().starts_with("/ggml-org/llama.cpp/releases/download/") {
        return Err("Only official llama.cpp GitHub release assets are accepted.".into());
    }
    let mut response = client.get(url).send().map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?;
    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    let mut copied = 0u64;
    let mut last_update = 0u64;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 128 * 1024];
    loop {
        if cancelled() { return Err("Installation cancelled".into()); }
        let read = response.read(&mut buffer).map_err(|e| format!("Download interrupted: {e}"))?;
        if read == 0 { break; }
        copied += read as u64;
        if copied > asset.size { return Err("Download is larger than declared asset size".into()); }
        file.write_all(&buffer[..read]).map_err(|e| e.to_string())?;
        hasher.update(&buffer[..read]);
        if copied - last_update >= 4_000_000 {
            progress(&format!("Downloading {}", asset.name), copied, asset.size);
            last_update = copied;
        }
    }
    progress(&format!("Verifying {}", asset.name), copied, asset.size);
    file.flush().map_err(|e| e.to_string())?;
    if copied != asset.size { return Err(format!("Incomplete download for {}: expected {}, received {} bytes", asset.name, asset.size, copied)); }
    if format!("{:x}", hasher.finalize()) != expected.to_ascii_lowercase() {
        return Err(format!("SHA-256 verification failed for {}.", asset.name));
    }
    Ok(())
}

fn extract_zip(archive_path: &Path, destination: &Path, cancelled: &impl Fn() -> bool) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(File::open(archive_path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        if cancelled() { return Err("Installation cancelled".into()); }
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let relative = entry.enclosed_name().ok_or("Unsafe archive path")?.to_path_buf();
        if entry.unix_mode().is_some_and(|mode| mode & 0o170000 == 0o120000) {
            return Err("Symlinks are not accepted in executable archives".into());
        }
        let target = destination.join(relative);
        if entry.is_dir() { fs::create_dir_all(&target).map_err(|e| e.to_string())?; }
        else {
            if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
            let mut output = File::create(target).map_err(|e| e.to_string())?;
            io::copy(&mut entry, &mut output).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn find_server(folder: &Path, depth: usize) -> Option<PathBuf> {
    if depth > 6 { return None; }
    for entry in fs::read_dir(folder).ok()?.flatten() {
        let path = entry.path();
        if path.is_file() && path.file_name().and_then(|x| x.to_str()).is_some_and(|x| x.eq_ignore_ascii_case("llama-server.exe")) {
            return Some(path);
        }
        if path.is_dir() { if let Some(found) = find_server(&path, depth + 1) { return Some(found); } }
    }
    None
}

/// Move the previous numbered engine folder to a predictable directory without
/// downloading anything. Only a direct child of our own runtime/engines is moved.
/// This is intentionally non-destructive: failures leave the old installation alone.
pub fn migrate_legacy_install(runtime: &Path) -> Result<Option<PathBuf>, String> {
    let target = runtime.join("llama-cpp");
    if target.exists() { return Ok(find_server(&target, 0)); }
    let old_dir = runtime.join("engines");
    if !old_dir.is_dir() { return Ok(None); }
    let mut candidates: Vec<PathBuf> = fs::read_dir(&old_dir).map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.is_dir() && path.file_name().and_then(|n| n.to_str())
            .is_some_and(|name| name.starts_with("llama-") && (name.ends_with("-cuda12") || name.ends_with("-cpu"))))
        .filter(|path| find_server(path, 0).is_some()).collect();
    candidates.sort();
    // Prefer the CUDA 12 build for NVIDIA machines, if both exist.
    candidates.sort_by_key(|path| path.file_name().and_then(|n| n.to_str()).unwrap_or("").ends_with("-cuda12"));
    let Some(source) = candidates.pop() else { return Ok(None); };
    fs::rename(&source, &target).map_err(|e| format!(
        "Could not move the previous llama.cpp installation from {} to {}: {e}. Stop any running llama-server.exe and retry.",
        source.display(), target.display()
    ))?;
    let _ = fs::remove_dir(&old_dir); // only succeeds if no other installs remain
    Ok(find_server(&target, 0))
}

#[derive(serde::Serialize, serde::Deserialize)]
struct InstalledVersion { release_id: u64, cuda: bool }

pub fn install_windows(runtime: PathBuf, cuda: bool, progress: impl Fn(&str, u64, u64), cancelled: impl Fn() -> bool) -> Result<String, String> {
    if !cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        return Err("Automatic llama.cpp installation currently requires Windows x64.".into());
    }
    if cancelled() { return Err("Installation cancelled".into()); }
    if !runtime.join("llama-cpp").exists() {
        if let Some(existing) = migrate_legacy_install(&runtime)? {
            progress("Migrated previous llama.cpp to ./runtime/llama-cpp", 1, 1);
            return Ok(existing.to_string_lossy().into_owned());
        }
    }
    progress("Reading official llama.cpp releases", 0, 0);
    let client = Client::builder().timeout(Duration::from_secs(240))
        .user_agent("Solarium/0.1 (llama.cpp verified installer)")
        .build().map_err(|e| e.to_string())?;
    let releases: Vec<Release> = client.get("https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=30")
        .send().map_err(|e| e.to_string())?.error_for_status().map_err(|e| format!("Cannot read llama.cpp releases: {e}"))?
        .json().map_err(|e| format!("Invalid GitHub releases metadata: {e}"))?;
    let bundle = select_bundle_across_releases(&releases, cuda).ok_or_else(|| format!(
        "No official Windows x64 {} bundle appeared in the last {} releases. Choose CPU mode or select an existing executable.",
        if cuda { "CUDA 12" } else { "CPU" }, releases.len()))?;
    let installed = runtime.join("llama-cpp");
    if installed.exists() {
        let marker = installed.join("installed.json");
        let version: Option<InstalledVersion> = fs::read(&marker).ok()
            .and_then(|b| serde_json::from_slice(&b).ok());
        if version.is_some_and(|v| v.release_id == bundle.release.id && v.cuda == cuda) {
            if let Some(executable) = find_server(&installed, 0) {
                progress("Verified llama.cpp installation already current", 1, 1);
                return Ok(executable.to_string_lossy().into_owned());
            }
        }
    }
    fs::create_dir_all(&runtime).map_err(|e| e.to_string())?;
    let stage = runtime.join(".llama-cpp-installing");
    let backup = runtime.join(".llama-cpp-backup");
    if backup.exists() { return Err(format!(
        "An unfinished llama.cpp update backup is present at {}. Inspect and move it aside before retrying; Solarium will not delete it.", backup.display()
    )); }
    if stage.exists() { fs::remove_dir_all(&stage).map_err(|e| e.to_string())?; }
    fs::create_dir_all(&stage).map_err(|e| e.to_string())?;
    let result = (|| {
        for (i, asset) in std::iter::once(bundle.binary).chain(bundle.runtime).enumerate() {
            if cancelled() { return Err("Installation cancelled".into()); }
            let archive = stage.join(format!("asset-{i}.zip"));
            download_verified(&client, asset, &archive, &progress, &cancelled)?;
            progress(&format!("Extracting {}", asset.name), 0, 0);
            extract_zip(&archive, &stage, &cancelled)?;
            fs::remove_file(&archive).map_err(|e| e.to_string())?;
        }
        find_server(&stage, 0).ok_or_else(|| format!("Release {} contains no llama-server.exe", bundle.release.tag_name))?;
        let marker = serde_json::to_vec_pretty(&InstalledVersion { release_id: bundle.release.id, cuda })
            .map_err(|e| e.to_string())?;
        fs::write(stage.join("installed.json"), marker).map_err(|e| e.to_string())?;
        if cancelled() { return Err("Installation cancelled".into()); }
        // Atomic replacement on the same drive; preserve the previous install
        // if Windows reports a locked executable or a rename fails.
        let had_old = installed.exists();
        if had_old { fs::rename(&installed, &backup).map_err(|e| format!(
            "Cannot update llama.cpp while its files are open: {e}. Stop llama-server.exe first."
        ))?; }
        if let Err(error) = fs::rename(&stage, &installed) {
            if had_old {
                let restore = fs::rename(&backup, &installed);
                return Err(format!("Could not activate new llama.cpp: {error}. Previous installation restoration: {restore:?}"));
            }
            return Err(format!("Cannot finish llama.cpp installation: {error}"));
        }
        if had_old { let _ = fs::remove_dir_all(backup); }
        Ok(find_server(&installed, 0).ok_or("Installed server is missing")?.to_string_lossy().to_string())
    })();
    if result.is_err() { let _ = fs::remove_dir_all(stage); }
    else { progress("Verified ./runtime/llama-cpp/llama-server.exe installation", 1, 1); }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    fn test_release(id: u64, names: &[&str]) -> Release {
        Release { id, tag_name: format!("b{id}"), assets: names.iter().map(|name| ReleaseAsset {
            name: (*name).to_string(), browser_download_url: format!("https://github.com/ggml-org/llama.cpp/releases/download/b{id}/{name}"),
            size: 1, digest: Some(format!("sha256:{}", "a".repeat(64)))
        }).collect() }
    }
    #[test]
    fn migration_only_moves_known_legacy_directories() {
        let root = std::env::temp_dir().join(format!("solarium-llama-migration-{}", std::process::id()));
        let source = root.join("engines/llama-407842518-cuda12/bin");
        fs::create_dir_all(&source).unwrap();
        fs::write(source.join("llama-server.exe"), b"test").unwrap();
        let result = migrate_legacy_install(&root).unwrap().unwrap();
        assert_eq!(result, root.join("llama-cpp/bin/llama-server.exe"));
        assert!(result.exists());
        let _ = fs::remove_dir_all(root);
    }
    #[test]
    fn ignores_latest_stable_without_windows_assets() {
        let releases = vec![test_release(1, &["llama-source.tar.gz"]), test_release(2, &[
            "llama-b11234-bin-win-cuda-12.4-x64.zip", "cudart-llama-bin-win-cuda-12.4-x64.zip"] )];
        let selected = select_bundle_across_releases(&releases, true).unwrap();
        assert_eq!(selected.release.id, 2);
        assert!(selected.runtime.is_some());
    }
    #[test]
    fn cpu_uses_matching_package_without_cuda() {
        let releases = vec![test_release(3, &["llama-b123-bin-win-cpu-x64.zip", "llama-b123-bin-win-cuda-12.4-x64.zip"])];
        assert_eq!(select_bundle_across_releases(&releases, false).unwrap().binary.name, "llama-b123-bin-win-cpu-x64.zip");
    }
    #[test]
    fn rejects_arm64_and_unrelated_files() {
        assert!(!is_windows_archive("llama-b123-bin-win-cpu-arm64.zip", false));
        assert!(!is_windows_archive("cudart-llama-bin-win-cuda-12.4-x64.zip", true));
    }
}
