//! Repaired Glitch workspace integration. Model inference remains in Solarium.
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::{json, Value};
use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};

fn hidden(command: &mut Command) {
    crate::coding_tools::configure(command);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
}
pub fn root(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value).canonicalize().map_err(|e| e.to_string())?;
    if !path.is_dir() {
        return Err("Project root is not a directory".into());
    }
    Ok(path)
}
pub fn scoped(base: &Path, value: &str, allow_root: bool) -> Result<PathBuf, String> {
    if value.is_empty() || value.contains('\0') {
        return Err("A project path is required".into());
    }
    let proposed = Path::new(value);
    if proposed
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err("Parent traversal is not a project path".into());
    }
    let joined = if proposed.is_absolute() {
        proposed.to_path_buf()
    } else {
        base.join(proposed)
    };
    let mut ancestor = joined.clone();
    let mut missing = Vec::new();
    while !ancestor.exists() {
        let name = ancestor
            .file_name()
            .ok_or("Invalid project path")?
            .to_owned();
        missing.push(name);
        if !ancestor.pop() {
            return Err("Invalid project path".into());
        }
    }
    let mut resolved = ancestor.canonicalize().map_err(|e| e.to_string())?;
    for part in missing.into_iter().rev() {
        resolved.push(part)
    }
    if !resolved.starts_with(base) || (!allow_root && resolved == base) {
        return Err("Path is outside the selected project or targets its root".into());
    }
    Ok(resolved)
}
fn link(path: &Path) -> bool {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return false;
    };
    if meta.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    false
}
fn mutation_path(base: &Path, value: &str) -> Result<(), String> {
    let candidate = Path::new(value);
    let joined = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        base.join(candidate)
    };
    for part in joined.ancestors() {
        if part.canonicalize().is_ok_and(|p| p == base) {
            break;
        }
        if link(part) {
            return Err(
                "Edit the original project path instead of a symbolic link or junction".into(),
            );
        }
    }
    Ok(())
}
pub fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    if let Some(tail) = text.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{tail}")
    } else {
        text.strip_prefix(r"\\?\").unwrap_or(&text).to_owned()
    }
}
fn ignored(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | "target"
            | "dist"
            | "build"
            | ".venv"
            | "venv"
            | "__pycache__"
            | ".glitch"
            | ".solarium"
            | ".solarium-trash"
    ) || name.ends_with(".solarium.bak")
}
fn tree(base: &Path, path: &Path, count: &mut usize) -> Result<Vec<Value>, String> {
    let mut entries = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    entries.sort_by_key(|e| {
        (
            !e.path().is_dir(),
            e.file_name().to_string_lossy().to_lowercase(),
        )
    });
    let mut result = Vec::new();
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if ignored(&name)
            || (path == base
                && matches!(name.as_str(), "runtime" | "output")
                && base.join("docs/info/INFERENCE_ARCHITECTURE.md").is_file())
            || link(&entry.path())
        {
            continue;
        }
        let p = entry.path().canonicalize().map_err(|e| e.to_string())?;
        if !p.starts_with(base) {
            continue;
        }
        *count += 1;
        if *count > 30_000 {
            return Err(
                "Workspace tree exceeds 30,000 entries; choose a narrower project directory".into(),
            );
        }
        let directory = p.is_dir();
        let children = if directory {
            Some(tree(base, &p, count)?)
        } else {
            None
        };
        result.push(json!({"id":display_path(&p),"name":name,"path":display_path(&p),"isDirectory":directory,"children":children}));
    }
    Ok(result)
}
fn argument<'a>(args: &'a Value, name: &str) -> Result<&'a str, String> {
    args.get(name)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Missing {name}"))
}
#[tauri::command]
pub async fn glitch_workspace_action(
    root: String,
    operation: String,
    args: Value,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || workspace_action(&root, &operation, &args))
        .await
        .map_err(|e| e.to_string())?
}
fn workspace_action(root_value: &str, operation: &str, args: &Value) -> Result<Value, String> {
    let base = root(root_value)?;
    if operation == "tree" {
        return Ok(Value::Array(tree(&base, &base, &mut 0)?));
    }
    if operation == "search" {
        let hits = crate::creator::search_project_code(
            base.to_string_lossy().to_string(),
            argument(args, "query")?.into(),
        )?;
        let data = serde_json::to_value(hits).map_err(|e| e.to_string())?;
        let items=data.as_array().ok_or("Invalid search result")?.iter().map(|hit|{let relative=hit["path"].as_str().unwrap_or("");json!({"path":display_path(&base.join(relative)),"relativePath":relative,"line":hit["line"],"column":1,"preview":hit["text"]})}).collect::<Vec<_>>();
        return Ok(json!(items));
    }
    if operation.starts_with("git.") {
        let mut command = Command::new("git");
        command.current_dir(&base);
        hidden(&mut command);
        match operation {
            "git.commit" => {
                let message = argument(args, "message")?;
                if message.trim().is_empty() {
                    return Err("Commit message is empty".into());
                }
                command.args(["commit", "-m", message]);
            }
            "git.stage" | "git.unstage" | "git.discard" => {
                let path = scoped(&base, argument(args, "path")?, false)?;
                let relative = path.strip_prefix(&base).map_err(|e| e.to_string())?;
                match operation {
                    "git.stage" => {
                        command.args(["add", "--"]);
                    }
                    "git.unstage" => {
                        command.args(["restore", "--staged", "--"]);
                    }
                    _ => {
                        command.args(["restore", "--worktree", "--"]);
                    }
                }
                command.arg(relative);
            }
            _ => return Err("Unknown Git operation".into()),
        }
        let output = command.output().map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).into_owned());
        }
        return Ok(json!(String::from_utf8_lossy(&output.stdout)));
    }
    if !matches!(operation, "read" | "reveal") {
        mutation_path(&base, argument(args, "path")?)?;
    }
    let path = scoped(&base, argument(args, "path")?, false)?;
    let relative = path
        .strip_prefix(&base)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    match operation {
        "read" => {
            let size = fs::metadata(&path).map_err(|e| e.to_string())?.len();
            if size > 8_000_000 {
                return Err("Text file exceeds the editor's 8 MB capacity".into());
            }
            Ok(json!(fs::read_to_string(path).map_err(|e| e.to_string())?))
        }
        "write" => {
            if args.get("expected") == Some(&Value::Null) {
                crate::creator::apply_project_changes(
                    base.to_string_lossy().into_owned(),
                    vec![crate::creator::ProjectFileChange {
                        path: relative,
                        content: argument(args, "content")?.into(),
                        expected: None,
                    }],
                )?;
            } else {
                crate::creator::write_project_file(
                    base.to_string_lossy().into_owned(),
                    relative,
                    argument(args, "content")?.into(),
                    argument(args, "expected")?.into(),
                )?;
            }
            Ok(Value::Null)
        }
        "create.file" => {
            crate::creator::apply_project_changes(
                base.to_string_lossy().into_owned(),
                vec![crate::creator::ProjectFileChange {
                    path: relative,
                    content: String::new(),
                    expected: None,
                }],
            )?;
            Ok(Value::Null)
        }
        "create.directory" => {
            if path.exists() {
                return Err("A file or directory already exists at this path".into());
            }
            fs::create_dir_all(path).map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "rename" | "move" => {
            let target = if operation == "rename" {
                let name = argument(args, "name")?;
                if name.trim().is_empty()
                    || name.contains(['/', '\\', ':'])
                    || name == "."
                    || name == ".."
                {
                    return Err("Use a single file or folder name".into());
                }
                path.parent().ok_or("Invalid parent")?.join(name)
            } else {
                let parent = scoped(&base, argument(args, "parent")?, true)?;
                if !parent.is_dir() {
                    return Err("Destination is not a directory".into());
                }
                parent.join(path.file_name().ok_or("Missing file name")?)
            };
            mutation_path(&base, &target.to_string_lossy())?;
            let target = scoped(&base, &target.to_string_lossy(), false)?;
            if target.exists() {
                return Err("Destination already exists".into());
            }
            if target.starts_with(&path) {
                return Err("A directory cannot be moved into itself".into());
            }
            fs::rename(path, &target).map_err(|e| e.to_string())?;
            Ok(json!(display_path(&target)))
        }
        "delete" => {
            let trash = base.join(".solarium-trash");
            mutation_path(&base, &trash.to_string_lossy())?;
            fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
            let trash = scoped(&base, &trash.to_string_lossy(), false)?;
            let stamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_nanos();
            let destination = trash.join(format!(
                "{stamp}-{}",
                path.file_name().unwrap_or_default().to_string_lossy()
            ));
            let metadata = trash.join(format!("{stamp}.solarium-trash.json"));
            fs::write(
                &metadata,
                json!({"original":path,"saved":destination}).to_string(),
            )
            .map_err(|e| e.to_string())?;
            if let Err(error) = fs::rename(&path, &destination) {
                let _ = fs::remove_file(metadata);
                return Err(error.to_string());
            }
            Ok(json!({"trash":destination}))
        }
        "reveal" => {
            #[cfg(windows)]
            {
                let mut command = Command::new("explorer.exe");
                command.arg(format!("/select,{}", path.display()));
                hidden(&mut command);
                command.spawn().map_err(|e| e.to_string())?;
            }
            #[cfg(not(windows))]
            {
                Command::new("xdg-open")
                    .arg(path.parent().ok_or("No parent")?)
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        _ => Err("Unknown workspace operation".into()),
    }
}

struct Worker {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
    #[cfg(windows)]
    _job: crate::windows_job::JobObject,
}
impl Drop for Worker {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
#[derive(Default)]
pub struct ProjectService(Mutex<Option<Worker>>);
impl ProjectService {
    fn request(
        &self,
        app: &AppHandle,
        root: &str,
        method: &str,
        params: Value,
    ) -> Result<Value, String> {
        let mut slot = self
            .0
            .lock()
            .map_err(|_| "Project service lock unavailable")?;
        if let Some(worker) = slot.as_mut() {
            if worker
                .child
                .try_wait()
                .map_err(|e| e.to_string())?
                .is_some()
            {
                *slot = None;
            }
        }
        if slot.is_none() {
            *slot = Some(start_worker(app)?)
        }
        let worker = slot.as_mut().ok_or("Project service unavailable")?;
        let id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
            .to_string();
        let call = json!({"id":id,"root":root,"method":method,"params":params});
        if call.to_string().len() > 8_000_000 {
            return Err("Project request exceeds transport capacity".into());
        }
        writeln!(worker.input, "{call}").map_err(|e| e.to_string())?;
        worker.input.flush().map_err(|e| e.to_string())?;
        let mut response = String::new();
        if worker
            .output
            .by_ref()
            .take(8_000_001)
            .read_line(&mut response)
            .map_err(|e| e.to_string())?
            == 0
        {
            *slot = None;
            return Err("Glitch project service disconnected; read its project-service.log".into());
        }
        if response.len() > 8_000_000 {
            *slot = None;
            return Err("Project-service response exceeds transport capacity".into());
        }
        let value: Value = serde_json::from_str(&response)
            .map_err(|e| format!("Invalid project-service response: {e}"))?;
        if value["id"].as_str() != Some(&id) {
            return Err("Project-service response ID mismatch".into());
        }
        if value["ok"] != true {
            return Err(value["error"]
                .as_str()
                .unwrap_or("Project operation failed")
                .into());
        }
        Ok(value["result"].clone())
    }
}
fn start_worker(app: &AppHandle) -> Result<Worker, String> {
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../backend/solarium.py");
    let resource = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("backend/solarium.py");
    let script = if cfg!(debug_assertions) && development.is_file() {
        development
    } else {
        resource
    };
    if !script.is_file() {
        return Err("The bundled Glitch project service is missing".into());
    }
    let cache = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("glitch");
    fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    let mut candidates = Vec::new();
    if let Some(path) = std::env::var_os("SOLARIUM_PYTHON") {
        candidates.push(PathBuf::from(path))
    }
    if let Some(tools)=crate::coding_tools::installed(){candidates.push(tools.python);}
    candidates.extend([
        PathBuf::from("python"),
        PathBuf::from("python3"),
        PathBuf::from("py"),
    ]);
    let mut failures = Vec::new();
    for candidate in candidates {
        let mut command = Command::new(&candidate);
        if candidate.file_stem().is_some_and(|s| s == "py") {
            command.arg("-3");
        }
        let mut probe = Command::new(&candidate);
        if candidate.file_stem().is_some_and(|s| s == "py") {
            probe.arg("-3");
        }
        probe.args(["-I", "-X", "utf8"]).arg(&script).arg("--check");
        hidden(&mut probe);
        match probe.output() {
            Ok(output) if output.status.success() => {}
            Ok(output) => {
                failures.push(format!(
                    "{}: {}",
                    candidate.display(),
                    String::from_utf8_lossy(&output.stderr)
                ));
                continue;
            }
            Err(error) => {
                failures.push(format!("{}: {error}", candidate.display()));
                continue;
            }
        }
        let backend = script.parent().ok_or("Invalid backend directory")?;
        command
            .args(["-I", "-X", "utf8", "-u"])
            .arg(&script)
            .current_dir(backend)
            .env("SOLARIUM_PROJECT_CACHE", &cache)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::from(
                fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(cache.join("project-service.log"))
                    .map_err(|e| e.to_string())?,
            ));
        if let Some(parent) = Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
            let server = parent.join("node_modules/.bin/typescript-language-server.cmd");
            if server.is_file() {
                command.env("SOLARIUM_TYPESCRIPT_LANGUAGE_SERVER", server);
            }
        }
        hidden(&mut command);
        match command.spawn() {
            Ok(mut child) => {
                #[cfg(windows)]
                let job = match crate::windows_job::JobObject::create().and_then(|job| {
                    job.attach(&child)?;
                    Ok(job)
                }) {
                    Ok(job) => job,
                    Err(e) => {
                        let _ = child.kill();
                        return Err(e);
                    }
                };
                let input = child
                    .stdin
                    .take()
                    .ok_or("Project service stdin unavailable")?;
                let output = BufReader::new(
                    child
                        .stdout
                        .take()
                        .ok_or("Project service stdout unavailable")?,
                );
                return Ok(Worker {
                    child,
                    input,
                    output,
                    #[cfg(windows)]
                    _job: job,
                });
            }
            Err(error) => failures.push(format!("{}: {error}", candidate.display())),
        }
    }
    Err(format!("Python 3.10+ is required for project indexing/language services. Configure SOLARIUM_PYTHON. {}",failures.join("; ")))
}
#[tauri::command]
pub async fn glitch_project_request(
    app: AppHandle,
    root: String,
    method: String,
    params: Value,
) -> Result<Value, String> {
    const ALLOWED: &[&str] = &[
        "health",
        "index.refresh",
        "index.summary",
        "project.symbols",
        "project.references",
        "project.context",
        "git.status",
        "lsp.status",
        "lsp.inspect",
        "lsp.open",
        "lsp.change",
        "lsp.save",
        "lsp.close",
        "lsp.request",
        "lsp.diagnostics",
    ];
    if !ALLOWED.contains(&method.as_str()) {
        return Err("This project-service operation is not exposed".into());
    }
    let canonical = if method == "health" {
        root
    } else {
        display_path(&self::root(&root)?)
    };
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<ProjectService>()
            .request(&app, &canonical, &method, params)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Default)]
pub struct WorkspaceWatch(Mutex<Option<RecommendedWatcher>>);
#[tauri::command]
pub fn glitch_watch(
    app: AppHandle,
    state: State<WorkspaceWatch>,
    root: Option<String>,
) -> Result<(), String> {
    let mut slot = state
        .0
        .lock()
        .map_err(|_| "Workspace watcher unavailable")?;
    *slot = None;
    if let Some(value) = root {
        let base = self::root(&value)?;
        let event_root = base.clone();
        let mut watcher=notify::recommended_watcher(move|result:notify::Result<notify::Event>|{match result{Ok(event)=>{let paths=event.paths.into_iter().filter(|p|p.strip_prefix(&event_root).is_ok_and(|r|!r.components().any(|c|ignored(&c.as_os_str().to_string_lossy())))).map(|p|display_path(&p)).collect::<Vec<_>>();if !paths.is_empty(){let _=app.emit("workspace://fs-event",json!({"root":display_path(&event_root),"paths":paths,"kind":"change"}));}},Err(error)=>{let _=app.emit("workspace://fs-event",json!({"root":display_path(&event_root),"kind":"error","error":error.to_string(),"paths":[]}));}}}).map_err(|e|e.to_string())?;
        watcher
            .watch(&base, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;
        *slot = Some(watcher)
    }
    Ok(())
}
#[tauri::command]
pub fn glitch_workspace_settings(app: AppHandle, value: Option<Value>) -> Result<Value, String> {
    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("glitch-workspace-settings.json");
    if let Some(value) = value {
        let data = serde_json::to_string(&value).map_err(|e| e.to_string())?;
        if !value.is_object() || data.len() > 100_000 {
            return Err("Invalid workspace settings".into());
        }
        fs::write(path, data).map_err(|e| e.to_string())?;
        return Ok(value);
    }
    if !path.is_file() {
        return Ok(Value::Null);
    }
    serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
pub fn shutdown(app: &AppHandle) {
    if let Some(state) = app.try_state::<ProjectService>() {
        if let Ok(mut worker) = state.0.lock() {
            *worker = None
        }
    }
    if let Some(state) = app.try_state::<WorkspaceWatch>() {
        if let Ok(mut watcher) = state.0.lock() {
            *watcher = None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn workspace_paths_never_escape_or_target_the_project_root() {
        let base =
            std::env::temp_dir().join(format!("solarium-glitch-scope-{}", std::process::id()));
        fs::create_dir_all(&base).unwrap();
        let canonical = base.canonicalize().unwrap();
        assert!(scoped(&canonical, "../outside.txt", false).is_err());
        assert!(scoped(&canonical, ".", false).is_err());
        assert!(scoped(&canonical, "new/file.ts", false)
            .unwrap()
            .starts_with(&canonical));
        fs::remove_dir(&base).unwrap();
    }
    #[test]
    fn native_editor_saves_are_conflict_checked_and_deletes_are_recoverable() {
        let base =
            std::env::temp_dir().join(format!("solarium-glitch-files-{}", std::process::id()));
        fs::create_dir_all(&base).unwrap();
        let owner = base.to_string_lossy();
        workspace_action(&owner, "create.file", &json!({"path":"birds.ts"})).unwrap();
        workspace_action(
            &owner,
            "write",
            &json!({"path":"birds.ts","content":"水😀","expected":""}),
        )
        .unwrap();
        assert!(workspace_action(
            &owner,
            "write",
            &json!({"path":"birds.ts","content":"wrong","expected":"stale"})
        )
        .is_err());
        assert_eq!(fs::read_to_string(base.join("birds.ts")).unwrap(), "水😀");
        assert!(workspace_action(&owner, "create.file", &json!({"path":"birds.ts"})).is_err());
        assert!(workspace_action(&owner, "delete", &json!({"path":"."})).is_err());
        let moved = workspace_action(&owner, "delete", &json!({"path":"birds.ts"})).unwrap();
        assert!(!base.join("birds.ts").exists());
        assert_eq!(
            fs::read_to_string(moved["trash"].as_str().unwrap()).unwrap(),
            "水😀"
        );
        // This exclusively owned, absolute temporary test directory is removed after checking it.
        assert!(base.starts_with(std::env::temp_dir()));
        fs::remove_dir_all(base).unwrap();
    }
}
