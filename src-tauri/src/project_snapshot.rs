use std::{fs,io::Read,path::Path};
use sha2::{Digest,Sha256};
use serde::Serialize;
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Snapshot {pub sha256:String,pub files:usize}
pub fn snapshot(root:&Path)->Result<Snapshot,String>{
    fn walk(root:&Path,dir:&Path,out:&mut Vec<std::path::PathBuf>,depth:u8)->Result<(),String>{
        if depth>64{return Err("Source tree is too deep to fingerprint reliably".into())}
        for entry in fs::read_dir(dir).map_err(|e|e.to_string())?{let entry=entry.map_err(|e|e.to_string())?;let meta=fs::symlink_metadata(entry.path()).map_err(|e|e.to_string())?;let name=entry.file_name().to_string_lossy().into_owned();if meta.file_type().is_symlink(){continue}if meta.is_dir(){if ["node_modules",".git","target","dist","build","coverage",".venv","venv","__pycache__","runtime",".solarium-trash"].contains(&name.as_str()){continue}walk(root,&entry.path(),out,depth+1)?;}else if meta.is_file()&&!name.ends_with(".solarium.bak"){let ext=entry.path().extension().and_then(|v|v.to_str()).unwrap_or("").to_ascii_lowercase();if ["rs","ts","tsx","js","jsx","mjs","cjs","mts","cts","json","jsonc","html","css","scss","vue","svelte","py","toml","lock","yaml","yml","go","mod","sum","c","cpp","h","hpp","cs","java","kt","swift","dart","sh","ps1","sql","md","txt","xml"].contains(&ext.as_str())||[".gitignore","Dockerfile","Makefile"].contains(&name.as_str()){out.push(entry.path().strip_prefix(root).map_err(|e|e.to_string())?.to_path_buf());if out.len()>100_000{return Err("Source fingerprint exceeds 100,000 files; select a narrower project".into())}}}}
        Ok(())
    }
    let mut paths=Vec::new();walk(root,root,&mut paths,0)?;paths.sort();let count=paths.len();let mut hash=Sha256::new();let mut buffer=[0;65536];
    for relative in paths{let path=root.join(&relative);let mut file=fs::File::open(path).map_err(|e|e.to_string())?;hash.update(relative.to_string_lossy().replace('\\',"/").as_bytes());hash.update([0]);hash.update(file.metadata().map_err(|e|e.to_string())?.len().to_le_bytes());loop{let n=file.read(&mut buffer).map_err(|e|e.to_string())?;if n==0{break}hash.update(&buffer[..n]);}}
    Ok(Snapshot{sha256:format!("{:x}",hash.finalize()),files:count})
}
#[tauri::command]
pub async fn project_source_snapshot(root:String)->Result<Snapshot,String>{tauri::async_runtime::spawn_blocking(move||snapshot(&crate::creator::safe_root(&root)?)).await.map_err(|e|e.to_string())?}
#[cfg(test)]mod tests{use super::*;#[test]fn external_edits_and_new_files_invalidate_source_evidence(){let dir=std::env::temp_dir().join(format!("solarium-snapshot-{}",std::process::id()));fs::create_dir_all(&dir).unwrap();fs::write(dir.join("source.js"),"first").unwrap();let a=snapshot(&dir).unwrap();fs::write(dir.join("source.js"),"other").unwrap();let b=snapshot(&dir).unwrap();assert_ne!(a.sha256,b.sha256);fs::create_dir_all(dir.join("dist")).unwrap();fs::write(dir.join("dist/out.js"),"build output").unwrap();assert_eq!(b.sha256,snapshot(&dir).unwrap().sha256);fs::write(dir.join("new.js"),"new source").unwrap();assert_ne!(b.sha256,snapshot(&dir).unwrap().sha256);assert!(dir.starts_with(std::env::temp_dir()));fs::remove_dir_all(dir).unwrap();}}
