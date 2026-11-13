use serde::Serialize;
use serde_json::Value;
use std::{fs, io::Write, path::PathBuf};
use tauri::State;

#[derive(Clone, Serialize)]
pub struct TestCase { id: String, phase: String }

pub struct TestMode(pub Option<(TestCase, PathBuf)>);

impl TestMode {
    pub fn from_args() -> Result<Self, String> {
        let args: Vec<String> = std::env::args().skip(1).collect();
        if args.first().is_none_or(|arg| arg != "--spica-scenario") { return Ok(Self(None)); }
        let [_, key, id, phase] = args.as_slice() else { return Err("Invalid SPICA test arguments.".into()); };
        if key.len() != 32 || !key.bytes().all(|byte| byte.is_ascii_hexdigit()) || !["initial", "reopen"].contains(&phase.as_str()) {
            return Err("Invalid SPICA test scope.".into());
        }
        if !super::plan()["program"]["scenarios"].as_array().is_some_and(|cases| cases.iter().any(|case| case["id"] == id.as_str())) {
            return Err("Scenario is absent from the compiled application.".into());
        }
        let base = std::env::temp_dir().canonicalize().map_err(|e| e.to_string())?;
        let expected = base.join(format!("spica-run-{key}"));
        let dir = expected.canonicalize().map_err(|e| e.to_string())?;
        if dir != expected || !dir.is_dir() { return Err("The scenario fixture directory is unavailable.".into()); }
        Ok(Self(Some((TestCase { id: id.clone(), phase: phase.clone() }, dir))))
    }

    pub fn fixture(&self) -> Option<&PathBuf> { self.0.as_ref().map(|(_, path)| path) }
}

#[tauri::command]
pub fn spica_test_case(state: State<'_, TestMode>) -> Option<TestCase> {
    state.0.as_ref().map(|(case, _)| case.clone())
}

#[tauri::command]
pub fn finish_spica_test(app: tauri::AppHandle, state: State<'_, TestMode>, report: Value) -> Result<(), String> {
    let (case, dir) = state.0.as_ref().ok_or("This is a normal app window.")?;
    if report["id"] != case.id || report["phase"] != case.phase { return Err("Scenario result has the wrong identity.".into()); }
    let body = serde_json::to_vec(&report).map_err(|error| error.to_string())?;
    if body.len() > 120_000 { return Err("Scenario report exceeds the limit.".into()); }
    let file = dir.join(format!("{}.json", case.phase));
    let mut output = fs::OpenOptions::new().create_new(true).write(true).open(file).map_err(|error| error.to_string())?;
    output.write_all(&body).and_then(|()| output.sync_all()).map_err(|error| error.to_string())?;
    drop(output);
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn save_record_export(state: State<'_, TestMode>, name: String, body: String, format: String) -> Result<Option<String>, String> {
    if !super::plan()["program"]["grants"].as_array().is_some_and(|grants| grants.contains(&Value::from("files.export"))) {
        return Err("Capability denied · files.export".into());
    }
    if !["csv", "json"].contains(&format.as_str()) || body.len() > 16_000_000 || name.len() > 80 ||
        !name.bytes().all(|byte| byte.is_ascii_alphanumeric() || [b'-', b'_', b'.'].contains(&byte)) ||
        !name.ends_with(&format!(".{format}")) {
        return Err("Invalid export name or content.".into());
    }
    if let Some((test, directory)) = &state.0 {
        let path = directory.join(format!("{}-{name}", test.phase));
        write_export(&path, &body)?;
        return Ok(Some(name));
    }
    #[cfg(windows)]
    return tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new().add_filter(format.to_uppercase(), &[&format]).set_file_name(name).save_file() else {
            return Ok(None);
        };
        if path.extension().and_then(|ext| ext.to_str()).is_none_or(|ext| !ext.eq_ignore_ascii_case(&format)) {
            return Err(format!("Choose a .{format} destination."));
        }
        let directory = path.parent().ok_or("Choose a destination folder.")?.canonicalize().map_err(|e| e.to_string())?;
        let scoped = directory.join(path.file_name().ok_or("Choose a file name.")?);
        write_export(&scoped, &body)?;
        Ok(Some(scoped.to_string_lossy().into_owned()))
    }).await.map_err(|e| e.to_string())?;
    #[cfg(not(windows))]
    { let _ = (name, body, format); Err("The native export picker requires the Windows target.".into()) }
}

fn write_export(path: &std::path::Path, body: &str) -> Result<(), String> {
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(path).map_err(|e| format!("Could not create export: {e}"))?;
    let result = file.write_all(body.as_bytes()).and_then(|()| file.sync_all());
    drop(file);
    if let Err(error) = result { let _ = fs::remove_file(path); return Err(error.to_string()); }
    Ok(())
}
