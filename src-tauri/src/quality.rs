//! Small real repositories for the in-app quality runner. Never writes an existing project.
use serde::{Deserialize, Serialize};
use std::{fs, path::{Component, Path}, time::{SystemTime, UNIX_EPOCH}};

#[derive(Deserialize)]
pub struct FixtureFile { path: String, content: String }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fixture { root: String, files: usize }
fn valid_file(file: &FixtureFile) -> bool {
    let path = Path::new(&file.path);
    !file.path.is_empty() && !file.path.contains('\\') && !file.path.contains(':') &&
    path.components().all(|c| matches!(c, Component::Normal(_))) &&
    matches!(path.extension().and_then(|s| s.to_str()), Some("js" | "mjs" | "cjs" | "json" | "md" | "ts")) && file.content.len() <= 100_000
}
#[tauri::command]
pub fn create_quality_fixture(files: Vec<FixtureFile>) -> Result<Fixture, String> {
    if files.is_empty() || files.len() > 16 || files.iter().any(|f| !valid_file(f)) || files.iter().map(|f| f.content.len()).sum::<usize>() > 400_000 { return Err("Invalid quality fixture. Only bounded relative source files are accepted.".into()); }
    let mut seen = std::collections::HashSet::new();
    if files.iter().any(|f| !seen.insert(f.path.to_lowercase())) { return Err("Duplicate fixture path".into()); }
    let parent = fs::canonicalize(std::env::temp_dir()).map_err(|e| e.to_string())?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let root = parent.join(format!("solarium-quality-{}-{stamp}", std::process::id()));
    fs::create_dir(&root).map_err(|e| e.to_string())?;
    let canonical = fs::canonicalize(&root).map_err(|e| e.to_string())?;
    if !canonical.starts_with(&parent) { return Err("Fixture escaped the temporary workspace".into()); }
    for file in &files {
        let target = canonical.join(&file.path);
        if let Some(dir) = target.parent() { fs::create_dir_all(dir).map_err(|e| e.to_string())?; }
        fs::write(target, &file.content).map_err(|e| e.to_string())?;
    }
    Ok(Fixture { root: canonical.to_string_lossy().into_owned(), files: files.len() })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn fixture_paths_cannot_address_existing_or_foreign_files() {
        for path in ["../outside.js", "C:/outside.js", "/outside.js", "src\\outside.js", "src/run.exe", ""] { assert!(!valid_file(&FixtureFile { path: path.into(), content: "test".into() }), "{path}"); }
        assert!(valid_file(&FixtureFile { path: "src/index.js".into(), content: "export const value = 1;".into() }));
    }
}


/// Fingerprint the running native executable, not a source filename or a remembered build.
#[tauri::command]
pub async fn coding_quality_identity()->Result<serde_json::Value,String>{
    tauri::async_runtime::spawn_blocking(||{
        use sha2::{Digest,Sha256};use std::io::Read;
        static DIGEST:std::sync::OnceLock<String>=std::sync::OnceLock::new();
        let digest=if let Some(value)=DIGEST.get(){value.clone()}else{let path=std::env::current_exe().map_err(|e|e.to_string())?;let mut file=fs::File::open(path).map_err(|e|e.to_string())?;let mut hash=Sha256::new();let mut buffer=[0u8;65536];loop{let count=file.read(&mut buffer).map_err(|e|e.to_string())?;if count==0{break}hash.update(&buffer[..count]);}let value=format!("{:x}",hash.finalize());let _=DIGEST.set(value.clone());value};
        Ok(serde_json::json!({"nativeBinarySha256":digest,"version":env!("CARGO_PKG_VERSION")}))
    }).await.map_err(|e|e.to_string())?
}
