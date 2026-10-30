//! Install vLLM in an isolated, Solarium-owned WSL2 distro without exporting
//! (or modifying) the user's Ubuntu installation.
//!
//! Windows: <Solarium>/runtime/vllm/linux/ext4.vhdx
//! Linux:   /opt/solarium/vllm/venv inside the managed virtual disk.
use reqwest::blocking::Client;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

pub const DISTRO: &str = "Solarium-vLLM";
const CHECKSUM_URL: &str = "https://releases.ubuntu.com/noble/SHA256SUMS";
const IMAGE_BASE: &str = "https://releases.ubuntu.com/noble/";
const LINUX_ROOT: &str = "/opt/solarium";

#[derive(Debug, PartialEq)]
struct UbuntuImage { filename: String, sha256: String }

/// Choose a versioned, stable Ubuntu 24.04 WSL image from its published checksum list.
/// A `.wsl` image is a tar-format rootfs (Ubuntu documents importing it as tar).
fn select_image(checksums: &str) -> Option<UbuntuImage> {
    checksums.lines().filter_map(|line| {
        let mut parts = line.split_whitespace();
        let digest = parts.next()?;
        let filename = parts.next()?.trim_start_matches('*');
        if digest.len() != 64 || !digest.bytes().all(|c| c.is_ascii_hexdigit()) ||
            !filename.starts_with("ubuntu-24.04.") || !filename.ends_with("-wsl-amd64.wsl") ||
            !filename.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'.') {
            return None;
        }
        let version = filename.strip_prefix("ubuntu-24.04.")?.split('-').next()?;
        if !version.split('.').all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit())) { return None; }
        let numeric: Vec<u32> = version.split('.').map(|p| p.parse().ok()).collect::<Option<Vec<_>>>()?;
        Some((numeric, UbuntuImage { filename: filename.into(), sha256: digest.to_ascii_lowercase() }))
    }).max_by(|a, b| a.0.cmp(&b.0)).map(|(_, image)| image)
}

/// wsl.exe commonly writes its distro listing in UTF-16LE, sometimes with BOM.
fn wsl_text(bytes: &[u8]) -> String {
    if bytes.len() >= 2 && (bytes.starts_with(&[0xff, 0xfe]) || bytes.iter().skip(1).step_by(2).filter(|&&v| v == 0).count() > bytes.len() / 5) {
        let start = if bytes.starts_with(&[0xff, 0xfe]) { 2 } else { 0 };
        let words: Vec<u16> = bytes[start..].chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
        String::from_utf16_lossy(&words)
    } else { String::from_utf8_lossy(bytes).into_owned() }
}
fn diagnostics(out: &std::process::Output) -> String {
    let stderr = wsl_text(&out.stderr);
    let stdout = wsl_text(&out.stdout);
    let combined = format!("{} {}", stderr.trim(), stdout.trim());
    combined.chars().take(1800).collect()
}
fn managed_registered() -> Result<bool, String> {
    let output = Command::new("wsl.exe").args(["--list", "--quiet"]).output()
        .map_err(|e| format!("Cannot run wsl.exe: {e}. Install/enable WSL2 in Windows and restart."))?;
    if !output.status.success() {
        return Err(format!("WSL2 is not ready: {}. Run 'wsl --install --no-distribution' in an elevated terminal, restart, then retry.", diagnostics(&output)));
    }
    Ok(wsl_text(&output.stdout).lines().any(|s| s.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}').eq_ignore_ascii_case(DISTRO)))
}

fn image_download(client: &Client, image: &UbuntuImage, downloads: &Path,
    progress: &impl Fn(&str, u64, u64), cancelled: &impl Fn() -> bool) -> Result<PathBuf, String> {
    fs::create_dir_all(downloads).map_err(|e| e.to_string())?;
    let archive = downloads.join("ubuntu-rootfs.tar");
    // Re-use a fully verified previous download after an interrupted WSL import.
    if archive.exists() && checksum_matches(&archive, &image.sha256)? {
        progress("Using verified Ubuntu 24.04 WSL image", 1, 1);
        return Ok(archive);
    }
    let partial = downloads.join("ubuntu-rootfs.part");
    if partial.exists() { fs::remove_file(&partial).map_err(|e| e.to_string())?; }
    let url = format!("{IMAGE_BASE}{}", image.filename);
    let mut response = client.get(url).send().map_err(|e| format!("Ubuntu WSL download failed: {e}"))?
        .error_for_status().map_err(|e| format!("Unable to download official Ubuntu WSL image: {e}"))?;
    let size = response.content_length().unwrap_or(0);
    if size > 1_500_000_000 { return Err("Ubuntu WSL image is unexpectedly large".into()); }
    let outcome = (|| {
        let mut file = File::create(&partial).map_err(|e| e.to_string())?;
        let mut hash = Sha256::new();
        let mut received = 0u64;
        let mut last = 0u64;
        let mut buffer = [0u8; 128 * 1024];
        loop {
            if cancelled() { return Err("Installation cancelled".into()); }
            let count = response.read(&mut buffer).map_err(|e| format!("Ubuntu download interrupted: {e}"))?;
            if count == 0 { break; }
            received += count as u64;
            if received > 1_500_000_000 || (size > 0 && received > size) { return Err("Invalid Ubuntu download length".into()); }
            hash.update(&buffer[..count]);
            file.write_all(&buffer[..count]).map_err(|e| e.to_string())?;
            if received.saturating_sub(last) > 4_000_000 {
                progress("Downloading official Ubuntu 24.04 WSL image", received, size);
                last = received;
            }
        }
        file.flush().map_err(|e| e.to_string())?;
        if size > 0 && received != size { return Err("Ubuntu image download is incomplete".into()); }
        progress("Verifying Ubuntu WSL image SHA-256", received, received);
        if format!("{:x}", hash.finalize()) != image.sha256 { return Err("Ubuntu WSL checksum mismatch. Download rejected.".into()); }
        if archive.exists() { fs::remove_file(&archive).map_err(|e| e.to_string())?; }
        fs::rename(&partial, &archive).map_err(|e| e.to_string())?;
        Ok(archive)
    })();
    if outcome.is_err() { let _ = fs::remove_file(partial); }
    outcome
}
fn checksum_matches(path: &Path, expected: &str) -> Result<bool, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 128 * 1024];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        digest.update(&buffer[..n]);
    }
    Ok(format!("{:x}", digest.finalize()) == expected)
}

pub fn install(runtime: PathBuf, progress: impl Fn(&str, u64, u64), cancelled: impl Fn() -> bool) -> Result<String, String> {
    if !cfg!(all(target_os = "windows", target_arch = "x86_64")) { return Err("Managed vLLM requires Windows x64 with WSL2".into()); }
    if cancelled() { return Err("Installation cancelled".into()); }
    let folder = runtime.join("vllm");
    let linux = folder.join("linux");
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    progress("Checking Windows Subsystem for Linux", 0, 0);
    let installed = managed_registered()?;
    if installed && !linux.join("ext4.vhdx").exists() {
        // Never silently use a WSL installation living on a different drive.
        // The previous Solarium builds placed the managed distro under runtime/wsl/.
        return Err(format!("A WSL distribution named '{DISTRO}' already exists, but its disk was not found at {}. It may be installed in the old runtime/wsl folder. Back up that distro before migrating; Solarium will not unregister or overwrite it.", linux.display()));
    }
    if !installed {
        if linux.exists() && fs::read_dir(&linux).map_err(|e| e.to_string())?.next().is_some() {
            return Err(format!("A previous WSL import left files in {} but '{}' is not registered. Back up that folder first; then move it aside and retry. Nothing has been deleted.", linux.display(), DISTRO));
        }
        if cancelled() { return Err("Installation cancelled".into()); }
        progress("Reading official Ubuntu 24.04 LTS checksums", 0, 0);
        let client = Client::builder().connect_timeout(Duration::from_secs(30)).timeout(Duration::from_secs(3600))
            .user_agent("Solarium/0.1 WSL installer").build().map_err(|e| e.to_string())?;
        let checksums = client.get(CHECKSUM_URL).send().map_err(|e| e.to_string())?
            .error_for_status().map_err(|e| e.to_string())?
            .text().map_err(|e| e.to_string())?;
        let image = select_image(&checksums).ok_or("Official Ubuntu 24.04 WSL image was not listed in SHA256SUMS.")?;
        let archive = image_download(&client, &image, &folder.join("downloads"), &progress, &cancelled)?;
        if cancelled() { return Err("Installation cancelled".into()); }
        fs::create_dir_all(&linux).map_err(|e| e.to_string())?;
        progress("Importing Ubuntu into ./runtime/vllm/linux (WSL2 virtual disk)", 0, 0);
        let output = Command::new("wsl.exe").arg("--import").arg(DISTRO).arg(&linux).arg(&archive)
            .args(["--version", "2"]).output().map_err(|e| format!("WSL import could not start: {e}"))?;
        if !output.status.success() {
            return Err(format!("WSL import failed ({}): {}. Check 'wsl --status', disk space and virtualization. Your original Ubuntu distro was not touched.", output.status, diagnostics(&output)));
        }
        // The imported distro is now the source of truth. Remove the large temporary TAR.
        let _ = fs::remove_file(archive);
    }
    if cancelled() { return Err("Installation cancelled; managed WSL distro remains available for retry".into()); }
    progress("Installing Python and vLLM in managed WSL2 (see runtime/vllm/install.log)", 0, 0);
    let log_path = folder.join("install.log");
    let log = File::create(&log_path).map_err(|e| e.to_string())?;
    let stderr = log.try_clone().map_err(|e| e.to_string())?;
    let mut child = Command::new("wsl.exe").args(["-d", DISTRO, "-u", "root", "--", "bash", "-s", "--", LINUX_ROOT])
        .stdin(Stdio::piped()).stdout(Stdio::from(log)).stderr(Stdio::from(stderr))
        .spawn().map_err(|e| format!("Unable to start managed WSL installation: {e}"))?;
    child.stdin.take().ok_or("Installer stdin unavailable")?
        .write_all(include_bytes!("../../scripts/install-vllm-wsl.sh")).map_err(|e| e.to_string())?;
    // Poll rather than wait_with_output so that Cancel works during long pip downloads.
    let status = loop {
        if cancelled() {
            let _ = child.kill();
            let _ = child.wait();
            let _ = Command::new("wsl.exe").args(["--terminate", DISTRO]).output();
            return Err("Installation cancelled. Managed WSL files are preserved for retry.".into());
        }
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? { break status; }
        thread::sleep(Duration::from_millis(750));
    };
    if !status.success() {
        let log = fs::read_to_string(&log_path).unwrap_or_default();
        let tail: String = log.chars().rev().take(2200).collect::<String>().chars().rev().collect();
        return Err(format!("vLLM setup failed ({}). Check runtime/vllm/install.log. Last output: {}", status, tail));
    }
    progress("Verifying managed vLLM executable", 0, 0);
    let executable = format!("{LINUX_ROOT}/vllm/venv/bin/vllm");
    let output = Command::new("wsl.exe").args(["-d", DISTRO, "-u", "root", "--", "test", "-x", &executable])
        .output().map_err(|e| e.to_string())?;
    if !output.status.success() { return Err("vLLM package setup completed but its executable was not found".into()); }
    progress("Verified vLLM installation", 1, 1);
    Ok(format!("vLLM installed: {} (WSL2 filesystem under {}).", executable, linux.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn official_checksum_file_selects_latest_lts_wsl_tar() {
        let text = format!("{} *ubuntu-24.04.3-wsl-amd64.wsl\n{} *ubuntu-24.04.5-wsl-amd64.wsl\n{} *ubuntu-24.04.4-wsl-arm64.wsl\n", "a".repeat(64), "b".repeat(64), "c".repeat(64));
        let selected = select_image(&text).unwrap();
        assert_eq!(selected.filename, "ubuntu-24.04.5-wsl-amd64.wsl");
        assert_eq!(selected.sha256, "b".repeat(64));
    }
    #[test]
    fn correctly_decodes_wsl_unicode_output() {
        let line = "Ubuntu\r\nSolarium-vLLM\r\n";
        let utf16: Vec<u8> = line.encode_utf16().flat_map(|n| n.to_le_bytes()).collect();
        assert!(wsl_text(&utf16).contains("Solarium-vLLM"));
        assert_eq!(wsl_text(line.as_bytes()), line);
    }
}
