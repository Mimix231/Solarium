//! Public GGUF downloads pinned to a repository commit and published LFS SHA-256.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelFile {
    repository: String,
    revision: String,
    file_name: String,
    size_bytes: u64,
    sha256: String,
    license: String,
}
fn valid_repo(repo: &str) -> bool {
    repo.len() < 220
        && repo.split('/').count() == 2
        && repo.split('/').all(|p| {
            !p.is_empty()
                && p != "."
                && p != ".."
                && p.chars()
                    .all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
        })
}
fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(240))
        .user_agent("Solarium verified local models")
        .build()
        .map_err(|e| e.to_string())
}
fn files(repository: &str, revision: Option<&str>) -> Result<Vec<ModelFile>, String> {
    if !valid_repo(repository) {
        return Err("Use a public Hugging Face owner/repository".into());
    }
    if revision.is_some_and(|s| s.len() != 40 || !s.bytes().all(|b| b.is_ascii_hexdigit())) {
        return Err("Model revision must be an exact repository commit".into());
    }
    let url = if let Some(revision) = revision {
        format!("https://huggingface.co/api/models/{repository}/revision/{revision}?blobs=true")
    } else {
        format!("https://huggingface.co/api/models/{repository}?blobs=true")
    };
    let info: serde_json::Value = client()?
        .get(url)
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| format!("Public model metadata unavailable: {e}"))?
        .json()
        .map_err(|e| e.to_string())?;
    let revision = info["sha"]
        .as_str()
        .filter(|s| s.len() == 40 && s.bytes().all(|b| b.is_ascii_hexdigit()))
        .ok_or("Repository commit missing")?;
    let license = info["cardData"]["license"]
        .as_str()
        .unwrap_or("Not specified in repository metadata");
    let siblings = info["siblings"].as_array().ok_or("Model files missing")?;
    Ok(siblings
        .iter()
        .filter_map(|s| {
            let name = s["rfilename"].as_str()?;
            let sha = s["lfs"]["sha256"].as_str()?;
            let size = s["size"].as_u64()?;
            if !name.ends_with(".gguf")
                || name
                    .chars()
                    .any(|c| c.is_control() || "\\:*?\"<>|".contains(c))
                || Path::new(name)
                    .components()
                    .any(|c| !matches!(c, std::path::Component::Normal(_)))
                || sha.len() != 64
                || !sha.bytes().all(|b| b.is_ascii_hexdigit())
                || size == 0
            {
                return None;
            }
            Some(ModelFile {
                repository: repository.into(),
                revision: revision.into(),
                file_name: name.into(),
                size_bytes: size,
                sha256: sha.into(),
                license: license.into(),
            })
        })
        .collect())
}
#[tauri::command]
pub async fn list_model_download_files(repository: String) -> Result<Vec<ModelFile>, String> {
    tauri::async_runtime::spawn_blocking(move || files(&repository, None))
        .await
        .map_err(|e| e.to_string())?
}
fn sha_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 524288];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hash.finalize()))
}
fn download(
    asset: &ModelFile,
    directory: &str,
    progress: &impl Fn(&str, u64, u64),
    cancelled: &impl Fn() -> bool,
) -> Result<PathBuf, String> {
    let base = Path::new(directory)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !base.is_dir() {
        return Err("Choose an existing model-library directory".into());
    }
    let relative = PathBuf::from(asset.repository.replace('/', "--"))
        .join(&asset.revision[..12])
        .join(&asset.file_name);
    let target = crate::glitch::scoped(&base, &relative.to_string_lossy(), false)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if target.exists() {
        if !target
            .canonicalize()
            .map_err(|e| e.to_string())?
            .starts_with(&base)
        {
            return Err("Model target is outside its library".into());
        }
        if target.metadata().map_err(|e| e.to_string())?.len() == asset.size_bytes
            && sha_file(&target)? == asset.sha256
        {
            return Ok(target);
        }
        return Err("A different file already exists at this model destination; keep it safe and choose another library".into());
    }
    let partial = target.with_extension("gguf.partial");
    if let Ok(meta) = fs::symlink_metadata(&partial) {
        if meta.file_type().is_symlink()
            || !partial
                .canonicalize()
                .map_err(|e| e.to_string())?
                .starts_with(&base)
        {
            return Err("Partial model must be an owned regular library file".into());
        }
    }
    let offset = fs::metadata(&partial).map(|m| m.len()).unwrap_or(0);
    if offset > asset.size_bytes {
        return Err("Partial download exceeds the published model size".into());
    }
    if offset < asset.size_bytes {
        let mut url = reqwest::Url::parse(&format!(
            "https://huggingface.co/{}/resolve/{}/",
            asset.repository, asset.revision
        ))
        .map_err(|e| e.to_string())?;
        {
            let mut segments = url.path_segments_mut().map_err(|_| "Invalid model URL")?;
            segments.pop_if_empty();
            for part in asset.file_name.split('/') {
                segments.push(part);
            }
        }
        let http = client()?;
        let mut request = http.get(url);
        if offset > 0 {
            request = request.header(reqwest::header::RANGE, format!("bytes={offset}-"));
        }
        let mut response = request
            .send()
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        if offset > 0
            && (response.status() != reqwest::StatusCode::PARTIAL_CONTENT
                || !response
                    .headers()
                    .get(reqwest::header::CONTENT_RANGE)
                    .and_then(|s| s.to_str().ok())
                    .is_some_and(|s| s.starts_with(&format!("bytes {offset}-"))))
        {
            return Err("Download server did not confirm the exact resume range; the partial model was retained".into());
        }
        let mut output = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&partial)
            .map_err(|e| e.to_string())?;
        let mut count = offset;
        let mut last = offset;
        let mut buffer = [0; 524288];
        loop {
            if cancelled() {
                return Err(
                    "Model download cancelled; verified-commit partial file retained for Resume"
                        .into(),
                );
            }
            let n = response.read(&mut buffer).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            count += n as u64;
            if count > asset.size_bytes {
                return Err("Model exceeds its published size".into());
            }
            output.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
            if count - last >= 4_000_000 {
                progress(
                    &format!("Downloading {}", asset.file_name),
                    count,
                    asset.size_bytes,
                );
                last = count;
            }
        }
        output.sync_all().map_err(|e| e.to_string())?;
    }
    progress(
        "Checking complete model SHA-256",
        asset.size_bytes,
        asset.size_bytes,
    );
    if partial.metadata().map_err(|e| e.to_string())?.len() != asset.size_bytes
        || sha_file(&partial)? != asset.sha256
    {
        let rejected = partial.with_extension(format!(
            "partial.rejected-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::rename(&partial, &rejected).map_err(|e| e.to_string())?;
        return Err(format!("Model checksum/size mismatch. Preserved rejected bytes at {}. Retry starts a fresh verified download; no model was activated",rejected.display()));
    }
    if cancelled() {
        return Err("Model download cancelled before activation".into());
    }
    fs::rename(partial, &target).map_err(|e| e.to_string())?;
    fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(target.with_extension("gguf.source.json"))
        .and_then(|mut file| file.write_all(&serde_json::to_vec_pretty(asset).unwrap_or_default()))
        .map_err(|e| e.to_string())?;
    Ok(target)
}
#[tauri::command]
pub async fn start_model_download(
    app: tauri::AppHandle,
    jobs: tauri::State<'_, crate::install_jobs::InstallJobs>,
    repository: String,
    revision: String,
    file_name: String,
    directory: String,
) -> Result<String, String> {
    let asset = tauri::async_runtime::spawn_blocking(move || {
        files(&repository, Some(&revision))?
            .into_iter()
            .find(|a| a.file_name == file_name)
            .ok_or_else(|| {
                "This verified GGUF file is no longer in the selected repository commit".to_string()
            })
    })
    .await
    .map_err(|e| e.to_string())??;
    let id = jobs.begin("gguf")?;
    let manager = (*jobs).clone();
    let task = id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = download(
            &asset,
            &directory,
            &|phase, downloaded, total| manager.progress(&app, &task, phase, downloaded, total),
            &|| manager.cancellation_requested(&task),
        )
        .map(|path| path.to_string_lossy().into_owned());
        manager.finish(&app, &task, result);
    });
    Ok(id)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn public_repository_names_cannot_be_paths_or_urls() {
        for name in [
            "../escape",
            "https://host/repo",
            "owner/../repo",
            "owner/repo?query",
            "owner\\repo",
        ] {
            assert!(!valid_repo(name));
        }
        assert!(valid_repo("Qwen/Qwen3-Coder-30B-A3B-Instruct"));
    }
}
