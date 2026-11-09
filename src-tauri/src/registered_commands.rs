//! Explicit project-scoped argument vectors, persisted outside source. Registration never executes a process.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::Manager;
static MUTATION: std::sync::Mutex<()> = std::sync::Mutex::new(());
use crate::project_commands::ProjectCommand;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Proposal {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub purpose: String,
    pub kind: String,
    pub network: bool,
}
pub fn validate(root: &Path, p: &Proposal) -> Result<(), String> {
    if ![
        "node", "npm", "pnpm", "yarn", "bun", "python", "python3", "cargo", "rustc", "git",
        "cmake", "dotnet", "go",
    ]
    .contains(&p.program.as_str())
    {
        return Err("Choose an installed coding tool by name; shell interpreters and arbitrary executable paths are not accepted".into());
    }
    if p.args.len() > 64
        || p.args
            .iter()
            .any(|a| a.len() > 4096 || a.chars().any(|c| c.is_control() || "&|<>^%!".contains(c)))
        || p.args.iter().map(String::len).sum::<usize>() > 32768
    {
        return Err("Use a bounded argument vector without shell operators".into());
    }
    if p.purpose.trim().is_empty()
        || p.purpose.len() > 400
        || !["setup", "check", "test", "service"].contains(&p.kind.as_str())
    {
        return Err("Describe the command purpose and choose setup/check/test/service".into());
    }
    let cwd = Path::new(&p.cwd);
    if cwd.is_absolute()
        || cwd.components().any(|c| {
            !matches!(
                c,
                std::path::Component::Normal(_) | std::path::Component::CurDir
            )
        })
    {
        return Err("Command working directory must be project-relative".into());
    }
    let target = root
        .join(cwd)
        .canonicalize()
        .map_err(|e| format!("Working directory is unavailable: {e}"))?;
    if !target.starts_with(root) || !target.is_dir() {
        return Err("Working directory is outside the project".into());
    }
    for argument in &p.args {
        let value = argument.split_once('=').map(|(_, v)| v).unwrap_or(argument);
        let path = Path::new(value);
        if !value.starts_with('-')
            && (path.is_absolute()
                || path
                    .components()
                    .any(|c| matches!(c, std::path::Component::ParentDir))
                || value.starts_with("file:"))
        {
            return Err("Command file arguments must remain project-relative".into());
        }
    }
    if p.kind == "test"
        && !p.args.iter().any(|a| {
            ["test", "--test", "pytest", "unittest"].contains(&a.as_str()) || a.starts_with("test:")
        })
    {
        return Err(
            "A behavioural command must invoke a test runner or declared test script".into(),
        );
    }
    Ok(())
}
pub fn needs_network(p: &Proposal) -> bool {
    p.network
        || (["npm", "pnpm", "yarn", "bun"].contains(&p.program.as_str())
            && p.args.first().is_some_and(|a| {
                ["create", "add", "update", "dlx", "exec"].contains(&a.as_str())
                    || a == "install" && !p.args.iter().any(|v| v == "--offline")
            }))
        || p.args.iter().any(|a| a.starts_with("https://"))
}
fn file(app: &tauri::AppHandle, root: &Path) -> Result<PathBuf, String> {
    let hash = format!("{:x}", Sha256::digest(root.to_string_lossy().as_bytes()));
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("project-commands");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(hash + ".json"))
}
fn entries(app: &tauri::AppHandle, root: &Path) -> Result<Vec<Proposal>, String> {
    let file = file(app, root)?;
    if !file.exists() {
        return Ok(Vec::new());
    }
    serde_json::from_slice(&fs::read(file).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
fn spec(p: &Proposal) -> ProjectCommand {
    let encoded = serde_json::to_vec(p).unwrap_or_default();
    let digest = format!("{:x}", Sha256::digest(encoded));
    ProjectCommand {
        id: format!("local:{}", &digest[..24]),
        command: format!("{} {}", p.program, p.args.join(" ")),
        purpose: p.purpose.clone(),
        verification: p.kind == "check" || p.kind == "test",
        cwd: p.cwd.clone(),
        program: p.program.clone(),
        args: p.args.clone(),
        service: p.kind == "service",
        network: needs_network(p),
        behavioral: p.kind == "test",
    }
}
pub fn catalogue(app: &tauri::AppHandle, root: &Path) -> Result<Vec<ProjectCommand>, String> {
    let _guard = MUTATION.lock().map_err(|e| e.to_string())?;
    let mut out = crate::project_commands::catalogue(root)?;
    for p in entries(app, root)? {
        validate(root, &p)?;
        out.push(spec(&p));
    }
    Ok(out)
}
#[tauri::command]
pub fn register_project_command(
    app: tauri::AppHandle,
    root: String,
    proposal: Proposal,
) -> Result<ProjectCommand, String> {
    let _guard = MUTATION.lock().map_err(|e| e.to_string())?;
    let base = crate::creator::safe_root(&root)?;
    validate(&base, &proposal)?;
    let result = spec(&proposal);
    let mut list = entries(&app, &base)?;
    if list.iter().any(|p| spec(p).id == result.id) {
        return Ok(result);
    }
    if list.len() >= 128 {
        return Err("This project already has 128 registered commands".into());
    }
    list.push(proposal);
    let target = file(&app, &base)?;
    let temporary = target.with_extension("pending.json");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(&list).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(temporary, target).map_err(|e| e.to_string())?;
    Ok(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn commands_are_argument_vectors_and_scoped() {
        let root = std::env::temp_dir().canonicalize().unwrap();
        let mut p = Proposal {
            program: "node".into(),
            args: vec!["--test".into(), "tests/example.js".into()],
            cwd: ".".into(),
            kind: "test".into(),
            purpose: "Independent checks".into(),
            network: false,
        };
        assert!(validate(&root, &p).is_ok());
        p.args = vec!["--version".into()];
        assert!(validate(&root, &p).is_err());
        p.kind = "check".into();
        p.cwd = "..".into();
        assert!(validate(&root, &p).is_err());
        p.cwd = ".".into();
        p.program = "powershell".into();
        assert!(validate(&root, &p).is_err());
        p.program = "npm".into();
        p.args = vec!["install".into()];
        assert!(needs_network(&p));
        p.args.push("--offline".into());
        assert!(!needs_network(&p));
        p.args.push("&& rm".into());
        assert!(validate(&root, &p).is_err());
    }
}
