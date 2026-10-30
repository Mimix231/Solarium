//! Read-only GGUF folder discovery. Never follows directory symlinks or opens models.
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry { pub name: String, pub path: String, pub size_bytes: u64 }

fn scan_dir(dir: &Path, depth: usize, results: &mut Vec<CatalogEntry>, visited: &mut HashSet<PathBuf>) -> Result<(), String> {
    if depth > 4 || results.len() >= 500 { return Ok(()); }
    let canonical = fs::canonicalize(dir).map_err(|e| format!("Cannot access model folder: {e}"))?;
    if !visited.insert(canonical) { return Ok(()); }
    for result in fs::read_dir(dir).map_err(|e| format!("Cannot read model folder: {e}"))? {
        let entry = result.map_err(|e| e.to_string())?;
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        if ty.is_symlink() { continue; }
        let path = entry.path();
        if ty.is_dir() { scan_dir(&path, depth + 1, results, visited)?; }
        else if ty.is_file() && path.extension().and_then(|s| s.to_str()).is_some_and(|s| s.eq_ignore_ascii_case("gguf")) {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            if metadata.len() == 0 { continue; }
            results.push(CatalogEntry { name: path.file_name().and_then(|name| name.to_str()).unwrap_or("model.gguf").to_owned(),
                path: path.to_string_lossy().into_owned(), size_bytes: metadata.len() });
        }
        if results.len() >= 500 { break; }
    }
    Ok(())
}

#[tauri::command]
pub fn scan_gguf_directory(directory: String) -> Result<Vec<CatalogEntry>, String> {
    let folder = Path::new(&directory);
    if !folder.is_dir() { return Err("The selected GGUF directory does not exist.".into()); }
    let mut found = Vec::new();
    scan_dir(folder, 0, &mut found, &mut HashSet::new())?;
    found.sort_by(|a,b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn skips_empty_gguf_files() {
        let dir = std::env::temp_dir().join(format!("solarium-catalog-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("fake.gguf"), []).unwrap();
        fs::write(dir.join("actual.GGUF"), [1,2,3]).unwrap();
        let found = scan_gguf_directory(dir.to_string_lossy().into_owned()).unwrap();
        assert_eq!(found.len(), 1);
        let _ = fs::remove_dir_all(dir);
    }
}
