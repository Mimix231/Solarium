//! Glitch's real PTY terminal, scoped to the owning Solarium project.
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Seek, SeekFrom, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Emitter, Manager, State};

struct Session {
    root: PathBuf,
    log: PathBuf,
    finished: Arc<AtomicBool>,
    exit: Arc<Mutex<Option<u32>>>,
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    killer: Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>,
    #[cfg(windows)]
    _job: crate::windows_job::JobObject,
}
impl Drop for Session {
    fn drop(&mut self) {
        if let Ok(mut killer) = self.killer.lock() {
            let _ = killer.kill();
        }
    }
}
#[derive(Default)]
pub struct Terminals(Mutex<HashMap<String, Arc<Session>>>);

fn decode_page(bytes: &[u8], finished: bool) -> (String, usize) {
    let mut end = bytes.len();
    let mut offset = 0;
    while offset < end {
        match std::str::from_utf8(&bytes[offset..end]) {
            Ok(_) => break,
            Err(error) => {
                offset += error.valid_up_to();
                if let Some(count) = error.error_len() {
                    offset += count;
                } else {
                    if !finished {
                        end = offset;
                    }
                    break;
                }
            }
        }
    }
    (String::from_utf8_lossy(&bytes[..end]).into_owned(), end)
}
#[tauri::command]
pub fn glitch_terminal_create(
    app: AppHandle,
    state: State<Terminals>,
    root: String,
    cwd: String,
    title: Option<String>,
) -> Result<Value, String> {
    let root = crate::glitch::root(&root)?;
    let cwd = crate::glitch::scoped(&root, &cwd, true)?;
    if !cwd.is_dir() {
        return Err("Terminal working directory is not a project directory".into());
    }
    let shell = if cfg!(windows) {
        "powershell.exe"
    } else {
        "/bin/bash"
    };
    let mut command = CommandBuilder::new(shell);
    if cfg!(windows) {
        command.args(["-NoLogo", "-NoProfile"]);
    }
    // CMD/npm interpret a verbatim \\?\C: cwd as UNC and fall back to Windows.
    // Validation keeps the canonical root; the child receives its ordinary path.
    command.cwd(crate::glitch::display_path(&cwd));
    for (key, _) in std::env::vars() {
        if key.starts_with("CARGO_")
            || key.starts_with("RUSTC_")
            || key.starts_with("DEP_")
            || key.starts_with("TAURI_")
            || matches!(
                key.as_str(),
                "OUT_DIR" | "RUSTFLAGS" | "CARGO_ENCODED_RUSTFLAGS"
            )
        {
            command.env_remove(key);
        }
    }
    let pair = native_pty_system()
        .openpty(PtySize {
            rows: 24,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);
    #[cfg(windows)]
    let job = match crate::windows_job::JobObject::create().and_then(|job| {
        job.attach_pid(child.process_id().ok_or("Terminal PID unavailable")?)?;
        Ok(job)
    }) {
        Ok(job) => job,
        Err(error) => {
            let _ = child.kill();
            return Err(error);
        }
    };
    let killer = child.clone_killer();
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let id = format!(
        "pty-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    );
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("glitch/terminals");
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let log_path = directory.join(format!("{id}.log"));
    let mut log = fs::File::create(&log_path).map_err(|e| e.to_string())?;
    let finished = Arc::new(AtomicBool::new(false));
    let exit = Arc::new(Mutex::new(None));
    state
        .0
        .lock()
        .map_err(|_| "Terminal registry unavailable")?
        .insert(
            id.clone(),
            Arc::new(Session {
                root: root.clone(),
                log: log_path,
                finished: finished.clone(),
                exit: exit.clone(),
                writer: Mutex::new(writer),
                master: Mutex::new(pair.master),
                killer: Mutex::new(killer),
                #[cfg(windows)]
                _job: job,
            }),
        );
    let emitted = id.clone();
    std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    if let Err(error) = log.write_all(&buffer[..count]) {
                        let _ = app.emit("terminal://event", json!({"terminalId":emitted,"kind":"error","error":format!("Terminal log: {error}")}));
                        break;
                    }
                    let _ = app.emit(
                        "terminal://event",
                        json!({"terminalId":emitted,"kind":"data"}),
                    );
                }
                Err(error) => {
                    let _ = app.emit(
                        "terminal://event",
                        json!({"terminalId":emitted,"kind":"error","error":error.to_string()}),
                    );
                    break;
                }
            }
        }
        let _ = log.flush();
        let code = child.wait().ok().map(|s| s.exit_code());
        if let Ok(mut value) = exit.lock() {
            *value = code;
        }
        finished.store(true, Ordering::Release);
        let _ = app.emit(
            "terminal://event",
            json!({"terminalId":emitted,"kind":"exit","code":code}),
        );
    });
    Ok(
        json!({"id":id,"root":crate::glitch::display_path(&root),"title":title.unwrap_or_else(||"Terminal".into()),"cwd":crate::glitch::display_path(&cwd),"shell":shell}),
    )
}
fn session(state: &Terminals, id: &str, owner: &str) -> Result<Arc<Session>, String> {
    let target = state
        .0
        .lock()
        .map_err(|_| "Terminal registry unavailable")?
        .get(id)
        .cloned()
        .ok_or("Terminal no longer exists")?;
    if target.root != crate::glitch::root(owner)? {
        return Err("Terminal belongs to another project".into());
    }
    Ok(target)
}
#[tauri::command]
pub fn glitch_terminal_read(
    state: State<Terminals>,
    root: String,
    terminal_id: String,
    offset: u64,
) -> Result<Value, String> {
    let target = session(&state, &terminal_id, &root)?;
    let mut file = fs::File::open(&target.log).map_err(|e| e.to_string())?;
    let total = file.metadata().map_err(|e| e.to_string())?.len();
    if offset > total {
        return Err("Terminal log offset exceeds its length".into());
    }
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(1_000_000)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    let finished = target.finished.load(Ordering::Acquire);
    let (data, count) = decode_page(&bytes, finished && offset + bytes.len() as u64 >= total);
    let next = offset + count as u64;
    let code = *target
        .exit
        .lock()
        .map_err(|_| "Terminal exit state unavailable")?;
    Ok(
        json!({"data":data,"nextOffset":next,"more":next<total&&count>0,"finished":finished,"code":code}),
    )
}
#[tauri::command]
pub fn glitch_terminal_write(
    state: State<Terminals>,
    root: String,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    let target = session(&state, &terminal_id, &root)?;
    if target.finished.load(Ordering::Acquire) {
        return Err("Terminal process has exited".into());
    }
    let mut writer = target
        .writer
        .lock()
        .map_err(|_| "Terminal writer unavailable")?;
    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn glitch_terminal_resize(
    state: State<Terminals>,
    root: String,
    terminal_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    if cols == 0 || rows == 0 {
        return Err("Terminal dimensions must be positive".into());
    }
    let target = session(&state, &terminal_id, &root)?;
    let result = target
        .master
        .lock()
        .map_err(|_| "Terminal dimensions unavailable")?
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string());
    result
}
#[tauri::command]
pub fn glitch_terminal_kill(
    state: State<Terminals>,
    root: String,
    terminal_id: String,
) -> Result<(), String> {
    let _ = session(&state, &terminal_id, &root)?;
    state
        .0
        .lock()
        .map_err(|_| "Terminal registry unavailable")?
        .remove(&terminal_id);
    Ok(())
}
pub fn shutdown(app: &AppHandle) {
    if let Some(state) = app.try_state::<Terminals>() {
        if let Ok(mut sessions) = state.0.lock() {
            sessions.clear();
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unicode_split_across_pty_log_pages_is_lossless() {
        let source = "水😀 birbs café\r\n";
        for step in 1..8 {
            let mut pending = Vec::new();
            let mut text = String::new();
            for bytes in source.as_bytes().chunks(step) {
                pending.extend_from_slice(bytes);
                let (data, count) = decode_page(&pending, false);
                text.push_str(&data);
                pending.drain(..count);
            }
            text.push_str(&decode_page(&pending, true).0);
            assert_eq!(text, source);
        }
    }
}
