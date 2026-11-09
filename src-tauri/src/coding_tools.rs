//! Optional private Node/Python/language-server installation. Never changes the user's global toolchains.
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tools {
    pub node: PathBuf,
    pub python: PathBuf,
    pub language_server: PathBuf,
    pub node_version: String,
    pub python_version: String,
}
fn root() -> Result<PathBuf, String> {
    Ok(crate::runtime::ensure_runtime_dir()?.join("coding-tools"))
}
pub fn installed() -> Option<Tools> {
    let base = root().ok()?;
    let tools: Tools = serde_json::from_slice(&fs::read(base.join("active.json")).ok()?).ok()?;
    let base = base.canonicalize().ok()?;
    if [&tools.node, &tools.python, &tools.language_server]
        .iter()
        .all(|p| p.is_file() && p.canonicalize().is_ok_and(|p| p.starts_with(&base)))
    {
        Some(tools)
    } else {
        None
    }
}
pub fn configure(command: &mut Command) {
    if let Some(tools) = installed() {
        let mut paths = vec![
            tools.node.parent().unwrap_or(Path::new("")).to_path_buf(),
            tools.python.parent().unwrap_or(Path::new("")).to_path_buf(),
            tools
                .language_server
                .parent()
                .unwrap_or(Path::new(""))
                .to_path_buf(),
        ];
        paths.extend(std::env::split_paths(
            &std::env::var_os("PATH").unwrap_or_default(),
        ));
        if let Ok(path) = std::env::join_paths(paths) {
            command.env("PATH", path);
        }
        command.env("SOLARIUM_TYPESCRIPT_LANGUAGE_SERVER", tools.language_server);
    }
}
pub fn executable(program: &str) -> Option<PathBuf> {
    let tools = installed()?;
    match program {
        "node" => Some(tools.node),
        "python" | "python3" => Some(tools.python),
        _ => None,
    }
}
#[tauri::command]
pub fn coding_tool_status() -> serde_json::Value {
    match installed() {
        Some(tools) => {
            serde_json::json!({"installed":true,"tools":tools,"scope":"Solarium private runtime; project-local tools still take priority"})
        }
        None => {
            serde_json::json!({"installed":false,"scope":"Using available system/project toolchains; portable tools are not installed"})
        }
    }
}
fn download(
    client: &Client,
    url: &str,
    sha: &str,
    path: &Path,
    progress: &impl Fn(&str, u64, u64),
    cancelled: &impl Fn() -> bool,
) -> Result<(), String> {
    if sha.len() != 64 || !sha.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Download is missing a published SHA-256 digest".into());
    }
    let mut response = client
        .get(url)
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    let total = response.content_length().unwrap_or(0);
    let mut output = fs::File::create(path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut count = 0;
    let mut reported = 0;
    let mut buffer = [0; 131072];
    loop {
        if cancelled() {
            return Err("Installation cancelled".into());
        }
        let n = response.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        count += n as u64;
        if count > 1_200_000_000 {
            return Err("Portable runtime archive exceeded 1.2 GB".into());
        }
        output.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
        hash.update(&buffer[..n]);
        if count - reported >= 4 * 1024 * 1024 || count == total {
            progress("Downloading verified coding tools", count, total);
            reported = count;
        }
    }
    output.sync_all().map_err(|e| e.to_string())?;
    if format!("{:x}", hash.finalize()) != sha.to_lowercase() {
        return Err(
            "Portable runtime SHA-256 mismatch; the active installation was not changed".into(),
        );
    }
    Ok(())
}
fn find(dir: &Path, name: &str, depth: u8) -> Option<PathBuf> {
    if depth > 7 {
        return None;
    }
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        let meta = fs::symlink_metadata(&path).ok()?;
        if meta.file_type().is_symlink() {
            continue;
        }
        if meta.is_file()
            && entry
                .file_name()
                .to_string_lossy()
                .eq_ignore_ascii_case(name)
        {
            return Some(path);
        }
        if meta.is_dir() {
            if let Some(found) = find(&path, name, depth + 1) {
                return Some(found);
            }
        }
    }
    None
}
fn checked_version(program: &Path) -> Result<String, String> {
    let mut command = Command::new(program);
    command.arg("--version");
    crate::project_commands::clean_environment(&mut command);
    let output = command.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "{} did not execute successfully",
            program.display()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().into())
}
pub fn install(
    progress: impl Fn(&str, u64, u64),
    cancelled: impl Fn() -> bool,
) -> Result<String, String> {
    if !cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        return Err("Portable coding-tool installation currently supports Windows x64".into());
    }
    let base = root()?;
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let stage = base.join(format!(
        "install-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    fs::create_dir(&stage).map_err(|e| e.to_string())?;
    let client = Client::builder()
        .timeout(Duration::from_secs(240))
        .user_agent("Solarium local coding tools")
        .build()
        .map_err(|e| e.to_string())?;
    progress("Reading official Node.js LTS metadata", 0, 0);
    let releases: Vec<serde_json::Value> = client
        .get("https://nodejs.org/dist/index.json")
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .map_err(|e| e.to_string())?;
    let node = releases
        .iter()
        .find(|r| {
            r["lts"].is_string()
                && r["files"]
                    .as_array()
                    .is_some_and(|f| f.iter().any(|v| v == "win-x64-zip"))
        })
        .ok_or("No official Windows x64 Node LTS release found")?;
    let version = node["version"].as_str().ok_or("Invalid Node release")?;
    if !version
        .chars()
        .all(|c| c.is_ascii_digit() || c == '.' || c == 'v')
    {
        return Err("Invalid Node version metadata".into());
    }
    let name = format!("node-{version}-win-x64.zip");
    let sums = client
        .get(format!("https://nodejs.org/dist/{version}/SHASUMS256.txt"))
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .map_err(|e| e.to_string())?;
    let sha = sums
        .lines()
        .find_map(|line| {
            let mut f = line.split_whitespace();
            let sha = f.next()?;
            let file = f.next()?;
            (file == name).then_some(sha)
        })
        .ok_or("Node archive has no official checksum")?;
    let archive = stage.join("node.zip");
    download(
        &client,
        &format!("https://nodejs.org/dist/{version}/{name}"),
        sha,
        &archive,
        &progress,
        &cancelled,
    )?;
    progress("Extracting verified Node.js archive", 0, 0);
    crate::llama_installer::extract_zip(&archive, &stage, &cancelled)?;
    progress("Reading Python Build Standalone release metadata", 0, 0);
    let release: serde_json::Value = client
        .get("https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest")
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .map_err(|e| e.to_string())?;
    let assets = release["assets"]
        .as_array()
        .ok_or("Python release assets missing")?;
    let asset = assets
        .iter()
        .filter(|a| {
            a["name"].as_str().is_some_and(|n| {
                n.starts_with("cpython-3.13.")
                    && n.contains("x86_64-pc-windows-msvc")
                    && !n.contains("freethreaded")
                    && n.ends_with("install_only_stripped.tar.gz")
            })
        })
        .max_by_key(|a| a["name"].as_str().unwrap_or(""))
        .ok_or("No compatible maintained Python 3.13 Windows archive found")?;
    let address = asset["browser_download_url"]
        .as_str()
        .ok_or("Python URL missing")?;
    if !address
        .starts_with("https://github.com/astral-sh/python-build-standalone/releases/download/")
    {
        return Err("Unexpected Python release URL".into());
    }
    let digest = asset["digest"]
        .as_str()
        .and_then(|s| s.strip_prefix("sha256:"))
        .ok_or("Python release has no published SHA-256")?;
    let archive = stage.join("python.tar.gz");
    download(&client, address, digest, &archive, &progress, &cancelled)?;
    progress("Extracting verified portable Python archive", 0, 0);
    let mut tar = tar::Archive::new(flate2::read::GzDecoder::new(
        fs::File::open(archive).map_err(|e| e.to_string())?,
    ));
    for entry in tar.entries().map_err(|e| e.to_string())? {
        if cancelled() {
            return Err("Installation cancelled".into());
        }
        let mut entry = entry.map_err(|e| e.to_string())?;
        if !entry.header().entry_type().is_file() && !entry.header().entry_type().is_dir() {
            return Err("Portable Python contains unsupported link entries".into());
        }
        if !entry.unpack_in(&stage).map_err(|e| e.to_string())? {
            return Err("Portable Python archive escaped its installation".into());
        }
    }
    let node = find(&stage, "node.exe", 0).ok_or("Portable Node executable missing")?;
    let python = find(&stage, "python.exe", 0).ok_or("Portable Python executable missing")?;
    let node_version = checked_version(&node)?;
    let python_version = checked_version(&python)?;
    progress(
        "Installing local TypeScript and Python language services",
        0,
        0,
    );
    let npm = node
        .parent()
        .ok_or("Node folder missing")?
        .join("node_modules/npm/bin/npm-cli.js");
    let prefix = stage.join("language-services");
    fs::create_dir_all(&prefix).map_err(|e| e.to_string())?;
    let log = stage.join("language-services.log");
    let output = fs::File::create(&log).map_err(|e| e.to_string())?;
    let mut command = Command::new(&node);
    command
        .arg(npm)
        .args(["install", "--prefix"])
        .arg(&prefix)
        .args([
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "typescript@6",
            "typescript-language-server",
            "pyright",
        ])
        .env(
            "PATH",
            format!(
                "{};{}",
                node.parent().unwrap().display(),
                std::env::var("PATH").unwrap_or_default()
            ),
        )
        .current_dir(&stage)
        .stdout(Stdio::from(output.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(output));
    crate::project_commands::clean_environment(&mut command);
    command.env(
        "PATH",
        format!(
            "{};{}",
            node.parent().unwrap().display(),
            std::env::var("PATH").unwrap_or_default()
        ),
    );
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    let _job = {
        let job = crate::windows_job::JobObject::create()?;
        if let Err(error) = job.attach(&child) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        job
    };
    loop {
        if cancelled() {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Installation cancelled; prior active coding tools retained".into());
        }
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            if !status.success() {
                return Err(format!(
                    "Language service installation failed. Read {}",
                    log.display()
                ));
            }
            break;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    let language_server = prefix.join("node_modules/.bin/typescript-language-server.cmd");
    if !language_server.is_file() {
        return Err("TypeScript language server was not installed".into());
    }
    let compiler = prefix.join("node_modules/typescript/lib");
    if !compiler.join("tsserver.js").is_file() {
        return Err("Installed TypeScript does not provide the tsserver.js required by the language server".into());
    }
    for script in [compiler.join("tsc.js"), prefix.join("node_modules/typescript-language-server/lib/cli.mjs")] {
        let mut check = Command::new(&node);
        check.arg(script).arg("--version");
        crate::project_commands::clean_environment(&mut check);
        if !check.output().map_err(|error| error.to_string())?.status.success() {
            return Err("Installed TypeScript language tooling failed its executable version check".into());
        }
    }
    let tools = Tools {
        node,
        python,
        language_server,
        node_version,
        python_version,
    };
    let file = base.join("active.json");
    let pending = base.join("active.pending.json");
    fs::write(
        &pending,
        serde_json::to_vec_pretty(&tools).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(pending, file).map_err(|e| e.to_string())?;
    progress(
        "Private coding tools installed and executable versions verified",
        1,
        1,
    );
    Ok(format!(
        "{} · {} · {}",
        tools.node_version,
        tools.python_version,
        stage.display()
    ))
}
