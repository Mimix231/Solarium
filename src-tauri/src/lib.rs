mod glitch;
mod glitch_terminal;
use std::fs::{self, File};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use serde::Serialize;
use tauri::{Manager, State};

mod creator;
mod project_commands;
mod project_services;
mod registered_commands;
mod dependency_api;
mod project_snapshot;
mod spica_preview;
mod foundation;
mod quality;
mod runtime_profile;
mod model_download;
mod coding_tools;
#[cfg(windows)] mod windows_job;
mod runtime;
mod llama_installer;
mod gguf_catalog;
mod install_jobs;
mod vllm_installer;
use install_jobs::{InstallJob, InstallJobs};
use runtime::{ensure_runtime_dir, runtime_dir};

#[derive(Default)]
struct EngineProcesses {
    llama: Mutex<Option<Child>>,
    llama_model: Mutex<Option<String>>,
    llama_port: Mutex<Option<u16>>,
    llama_config:Mutex<Option<(u32,i32)>>,
    vllm: Mutex<Option<Child>>,
    #[cfg(windows)] job: Mutex<Option<windows_job::JobObject>>,
}

impl Drop for EngineProcesses {
    fn drop(&mut self) {
        let had_vllm = self.vllm.lock().is_ok_and(|slot| slot.is_some());
        for slot in [&self.llama, &self.vllm] {
            if let Ok(mut guard) = slot.lock() {
                if let Some(mut process) = guard.take() {
                    let _ = process.kill();
                    let _ = process.wait();
                }
            }
        }
        // A WSL client exiting is not equivalent to stopping the Linux server.
        #[cfg(windows)] {
            if had_vllm { let _ = Command::new("wsl.exe").args(["--terminate", vllm_installer::DISTRO]).status(); }
        }
        #[cfg(not(windows))] let _ = had_vllm;
    }
}

fn start_managed(state: &EngineProcesses, slot: &Mutex<Option<Child>>, command: &mut Command, label: &str, log_path: &Path) -> Result<String, String> {
    #[cfg(windows)]{use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
    let mut guard = slot.lock().map_err(|_| "Engine lock unavailable")?;
    if let Some(child) = guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            return Err(format!("A Solarium-managed {label} server is already running."));
        }
    }
    if let Some(folder) = log_path.parent() { fs::create_dir_all(folder).map_err(|e| e.to_string())?; }
    let stdout = File::create(log_path).map_err(|e| e.to_string())?;
    let stderr = stdout.try_clone().map_err(|e| e.to_string())?;
    let mut process = command.stdin(Stdio::null()).stdout(Stdio::from(stdout)).stderr(Stdio::from(stderr))
        .spawn().map_err(|e| format!("Unable to start {label}: {e}"))?;
    #[cfg(windows)] {
        let attached = (|| -> Result<(), String> {
            let mut job = state.job.lock().map_err(|_| "Job Object lock unavailable")?;
            if job.is_none() { *job = Some(windows_job::JobObject::create()?); }
            job.as_ref().ok_or("Job Object unavailable")?.attach(&process)
        })();
        if let Err(error) = attached {
            let _ = process.kill(); let _ = process.wait();
            return Err(format!("Unable to supervise {label}: {error}"));
        }
    }
    #[cfg(not(windows))] let _ = state;
    let pid = process.id();
    *guard = Some(process);
    Ok(format!("Started {label} (PID {pid}). Check the endpoint after model loading completes. Log: {}", log_path.display()))
}

fn stop_managed(slot: &Mutex<Option<Child>>, label: &str) -> Result<String, String> {
    let mut guard = slot.lock().map_err(|_| "Engine lock unavailable")?;
    match guard.take() {
        Some(mut process) => {
            let _ = process.kill();
            let _ = process.wait();
            Ok(format!("Stopped Solarium-managed {label} process."))
        }
        None => Err(format!("No Solarium-managed {label} process is running.")),
    }
}

#[tauri::command]
fn start_llama_server(
    state: State<'_, EngineProcesses>, executable: String, gguf: String,
    port: u16, context: u32, gpu_layers: i32,
) -> Result<String, String> {
    let path = Path::new(&executable);
    let model = Path::new(&gguf);
    if !path.is_file() { return Err("llama-server executable does not exist.".into()); }
    if !model.is_file() || !model.extension().and_then(|x| x.to_str()).is_some_and(|x| x.eq_ignore_ascii_case("gguf")) {
        return Err("Select an existing GGUF model file.".into());
    }
    let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    if filename != "llama-server" { return Err("Only an executable named llama-server may be launched.".into()); }
    if port < 1024 || context < 256 || context > 262_144 || !(-1..=999).contains(&gpu_layers) {
        return Err("Invalid port, GPU layers, or context length.".into());
    }
    let mut command = Command::new(path);
    command.args(["-m", &gguf, "--host", "127.0.0.1", "--port", &port.to_string(),
        "-c", &context.to_string(), "--n-gpu-layers", &gpu_layers.to_string(), "--context-shift", "--jinja", "--parallel", "1", "--no-webui"]);
    if let Some(folder) = path.parent() { command.current_dir(folder); }
    if std::net::TcpStream::connect(("127.0.0.1", port)).is_ok() {
        if let Some(existing_id) = compatible_existing_llama(port, &gguf) {
            return Ok(format!("Connected to compatible existing llama.cpp server ({existing_id}) on port {port}. Its original process remains externally managed."));
        }
        return Err(format!("Port {port} is occupied by a different server. Solarium will not terminate unrelated processes; stop that server first."));
    }
    let log = ensure_runtime_dir()?.join("logs/llama.log");
    let outcome = start_managed(&state, &state.llama, &mut command, "llama.cpp", &log)?;
    *state.llama_model.lock().map_err(|_| "Model state lock unavailable")? = Some(gguf);
    *state.llama_port.lock().map_err(|_| "Engine port lock unavailable")? = Some(port);
    *state.llama_config.lock().map_err(|_| "Engine configuration lock unavailable")?=Some((context,gpu_layers));
    Ok(outcome)
}

#[tauri::command]
fn stop_llama_server(state: State<'_, EngineProcesses>) -> Result<String, String> {
    let result = stop_managed(&state.llama, "llama.cpp");
    *state.llama_model.lock().map_err(|_| "Model state lock unavailable")? = None;
    *state.llama_port.lock().map_err(|_| "Engine port lock unavailable")? = None;
    result
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelActivation { model_id: String, detail: String }

/// Connect to an existing loopback inference server only if the loaded model ID
/// matches the requested GGUF. The process is never adopted as Solarium-owned:
/// we may use its endpoint, but we must not terminate or overwrite it.
fn compatible_existing_llama(port: u16, gguf: &str) -> Option<String> {
    let client = reqwest::blocking::Client::builder().timeout(Duration::from_secs(2)).build().ok()?;
    let value: serde_json::Value = client.get(format!("http://127.0.0.1:{port}/v1/models"))
        .send().ok()?.error_for_status().ok()?.json().ok()?;
    let wanted = Path::new(gguf).file_name()?.to_str()?.to_lowercase();
    let stem = Path::new(gguf).file_stem()?.to_str()?.to_lowercase();
    for loaded in value.get("data")?.as_array()? {
        let id = loaded.get("id")?.as_str()?;
        let actual = Path::new(id).file_name()?.to_str()?.to_lowercase();
        if actual == wanted || actual == stem {
            return Some(id.to_owned());
        }
    }
    None
}

/// A catalog selection *actually loads* its GGUF before a conversation uses it.
/// A successful return requires an online `/v1/models` response; errors never
/// masquerade as a selected model. This replaces old single-server state.
fn activate_gguf_model_inner(state: &EngineProcesses, executable: String, gguf: String,
    port: u16, context: u32, gpu_layers: i32) -> Result<ModelActivation, String> {
    if !Path::new(&executable).is_file() ||
       Path::new(&executable).file_stem().and_then(|s| s.to_str()) != Some("llama-server") {
        return Err("Install llama.cpp or choose llama-server.exe in Models first.".into());
    }
    if !Path::new(&gguf).is_file() || !Path::new(&gguf).extension().and_then(|s| s.to_str()).is_some_and(|s| s.eq_ignore_ascii_case("gguf")) {
        return Err("GGUF file is missing. Rescan your configured model folder.".into());
    }
    if port < 1024 || !(256..=262_144).contains(&context) || !(-1..=999).contains(&gpu_layers) {
        return Err("Invalid llama.cpp runtime settings.".into());
    }
    let same = state.llama_model.lock().map_err(|_| "Model state lock unavailable")?
        .as_deref() == Some(gguf.as_str()) &&
        *state.llama_port.lock().map_err(|_| "Engine port lock unavailable")? == Some(port) &&
        *state.llama_config.lock().map_err(|_| "Engine configuration lock unavailable")? == Some((context,gpu_layers));
    let alive = {
        let mut child = state.llama.lock().map_err(|_| "Engine state lock unavailable")?;
        child.as_mut().is_some_and(|c| c.try_wait().ok().flatten().is_none())
    };
    if !(same && alive) {
        let current_port = *state.llama_port.lock().map_err(|_| "Engine port lock unavailable")?;
        if std::net::TcpStream::connect_timeout(&format!("127.0.0.1:{port}").parse().map_err(|e| format!("Invalid port: {e}"))?, Duration::from_millis(500)).is_ok() && !(alive && current_port == Some(port)) {
            if let Some(existing_id) = compatible_existing_llama(port, &gguf) {
                return Ok(ModelActivation { model_id: existing_id,
                    detail: format!("Connected to an existing llama.cpp-compatible server on port {port}. This external process remains owned by its original launcher.") });
            }
            return Err(format!("Port {port} belongs to an unrelated or different-model server. Stop it or use another port. Solarium will not kill unknown processes."));
        }
        if alive { let _ = stop_managed(&state.llama, "llama.cpp"); }
        let mut command = Command::new(&executable);
        command.args(["-m", &gguf, "--host", "127.0.0.1", "--port", &port.to_string(),
            "-c", &context.to_string(), "--n-gpu-layers", &gpu_layers.to_string(), "--context-shift", "--jinja", "--parallel", "1", "--no-webui"]);
        if let Some(folder) = Path::new(&executable).parent() { command.current_dir(folder); }
        start_managed(&state, &state.llama, &mut command, "llama.cpp", &ensure_runtime_dir()?.join("logs/llama.log"))?;
        *state.llama_model.lock().map_err(|_| "Model state lock unavailable")? = Some(gguf.clone());
        *state.llama_port.lock().map_err(|_| "Engine port lock unavailable")? = Some(port);
    *state.llama_config.lock().map_err(|_| "Engine configuration lock unavailable")?=Some((context,gpu_layers));
    }
    let client = reqwest::blocking::Client::builder().timeout(Duration::from_secs(3))
        .build().map_err(|e| e.to_string())?;
    let url = format!("http://127.0.0.1:{port}/v1/models");
    for _ in 0..90 {
        if let Ok(response) = client.get(&url).send() {
            if let Ok(response) = response.error_for_status() {
                if let Ok(body) = response.json::<serde_json::Value>() {
                    if let Some(identifier) = body.get("data").and_then(|v| v.as_array())
                        .and_then(|v| v.first()).and_then(|v| v.get("id")).and_then(|v| v.as_str()) {
                        return Ok(ModelActivation { model_id: identifier.to_owned(),
                            detail: format!("llama.cpp is ready with {}", Path::new(&gguf).file_name().and_then(|name| name.to_str()).unwrap_or("model")) });
                    }
                }
            }
        }
        let exited = {
            let mut child = state.llama.lock().map_err(|_| "Engine state lock unavailable")?;
            child.as_mut().is_some_and(|c| c.try_wait().ok().flatten().is_some())
        };
        if exited { break; }
        thread::sleep(Duration::from_secs(1));
    }
    let _ = stop_managed(&state.llama, "llama.cpp");
    *state.llama_model.lock().map_err(|_| "Model state lock unavailable")? = None;
    *state.llama_port.lock().map_err(|_| "Engine port lock unavailable")? = None;
    Err("llama.cpp failed to become ready within 90 seconds. Check Models → View logs for DLL, CUDA or memory errors.".into())
}

#[tauri::command]
async fn model_load_plan(app:tauri::AppHandle,gguf:String,context:u32)->Result<runtime_profile::LoadPlan,String>{
    tauri::async_runtime::spawn_blocking(move||{
        let state=app.state::<EngineProcesses>();
        let same=state.llama_model.lock().map_err(|e|e.to_string())?.as_deref()==Some(gguf.as_str());
        let alive=state.llama.lock().map_err(|e|e.to_string())?.as_mut().is_some_and(|c|c.try_wait().ok().flatten().is_none());
        let resident=if same&&alive{state.llama_config.lock().map_err(|e|e.to_string())?.filter(|(size,_)|*size==context).map(|(_,layers)|layers)}else{None};
        runtime_profile::plan(&gguf,context,resident)
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
fn local_coding_probe()->serde_json::Value{use std::time::{SystemTime,UNIX_EPOCH};serde_json::json!({"value":format!("SOLARIUM-{}-{}",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()),"source":"executed native read-only probe"})}

#[tauri::command]
async fn activate_gguf_model(app: tauri::AppHandle, executable: String, gguf: String,
    port: u16, context: u32, gpu_layers: i32) -> Result<ModelActivation, String> {
    // Loading a GGUF may take tens of seconds. Never hold up Tauri's UI thread.
    tauri::async_runtime::spawn_blocking(move || {
        let engines = app.state::<EngineProcesses>();
        activate_gguf_model_inner(&engines, executable, gguf, port, context, gpu_layers)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn start_vllm_server(
    state: State<'_, EngineProcesses>, model: String,
    port: u16, context: u32, gpu_memory_utilization: f32,
) -> Result<String, String> {
    if !cfg!(target_os = "windows") { return Err("WSL2 launch is currently supported on Windows hosts only. On Linux, start vLLM manually and register its endpoint.".into()); }
    if model.is_empty() || model.len() > 400 || model.starts_with('-') || model.chars().any(char::is_control) {
        return Err("Enter a valid Hugging Face model ID or Linux model path.".into());
    }
    if !(1024..=65535).contains(&port) || !(512..=65_536).contains(&context) ||
        !gpu_memory_utilization.is_finite() || !(0.2..=0.7).contains(&gpu_memory_utilization) {
        return Err("Invalid port, context size, or GPU memory fraction.".into());
    }
    // Explicit arguments rather than a shell: model names and paths are not executed as code.
    let managed = vllm_installer::DISTRO;
    let linux_runtime = "/opt/solarium";
    let venv_binary = format!("{linux_runtime}/vllm/venv/bin/vllm");
    let installed = Command::new("wsl.exe").args(["-d", managed, "--", "test", "-x", &venv_binary])
        .status().is_ok_and(|status| status.success());
    if !installed {
        return Err(format!("vLLM is not installed in {linux_runtime}/vllm/venv. Run Install vLLM in WSL2 first."));
    }
    // WSL receives separate arguments. No shell interpolation of model IDs or Windows paths.
    let mut command = Command::new("wsl.exe");
    command.args(["-d", managed, "--", "env"])
        .arg(format!("HF_HOME={linux_runtime}/huggingface"))
        .arg(format!("XDG_CACHE_HOME={linux_runtime}/cache"))
        .arg(format!("VLLM_CACHE_ROOT={linux_runtime}/cache/vllm"))
        .arg(format!("CUDA_CACHE_PATH={linux_runtime}/cache/cuda"))
        .arg(format!("TRITON_CACHE_DIR={linux_runtime}/cache/triton"))
        .arg(format!("TMPDIR={linux_runtime}/tmp"))
        .arg(&venv_binary)
        .args(["serve", &model, "--host", "127.0.0.1", "--port", &port.to_string(),
            "--max-model-len", &context.to_string(),
            "--gpu-memory-utilization", &gpu_memory_utilization.to_string()]);
    if std::net::TcpStream::connect(("127.0.0.1", port)).is_ok() {
        if compatible_existing_llama(port, &model).is_some() {
            return Ok(format!("Connected to compatible existing vLLM server on port {port}. The original process remains externally managed."));
        }
        return Err(format!("Port {port} is already occupied by a different server. Solarium will not kill it."));
    }
    let log = ensure_runtime_dir()?.join("logs/vllm.log");
    start_managed(&state, &state.vllm, &mut command, "vLLM (WSL2)", &log)
}

#[tauri::command]
fn stop_vllm_server(state: State<'_, EngineProcesses>) -> Result<String, String> {
    let result = stop_managed(&state.vllm, "vLLM (WSL2)");
    if cfg!(target_os = "windows") {
        // WSL2 is a separate Linux VM. Killing wsl.exe does not reliably terminate
        // the forwarded Linux service. The managed distro is dedicated to Solarium.
        let _ = Command::new("wsl.exe").args(["--terminate", vllm_installer::DISTRO]).status();
    }
    result
}


#[tauri::command]
fn cancel_install_job(app: tauri::AppHandle, jobs: State<'_, InstallJobs>, id: String) -> Result<(), String> {
    jobs.request_cancel(&app, &id)
}

#[tauri::command]
fn get_install_jobs(state: State<'_, InstallJobs>) -> Vec<InstallJob> { state.list() }

/// Returns immediately with a job ID; actual installation is owned by Rust,
/// not by a mounted React component or an awaited browser event listener.
#[tauri::command]
fn start_install_job(app: tauri::AppHandle, jobs: State<'_, InstallJobs>, engine: String,
                     cuda: Option<bool>) -> Result<String, String> {
    if engine != "llama.cpp" && engine != "vllm" && engine != "coding-tools" { return Err("Unknown installer engine".into()); }
    let id = jobs.begin(&engine)?;
    let manager = (*jobs).clone();
    let job_id = id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = if engine == "coding-tools" {coding_tools::install(|phase,downloaded,total|manager.progress(&app,&job_id,phase,downloaded,total),||manager.cancellation_requested(&job_id))}else if engine == "llama.cpp" {
            match ensure_runtime_dir() {
                Ok(root) => llama_installer::install_windows(root, cuda.unwrap_or(true), |phase, downloaded, total| {
                    manager.progress(&app, &job_id, phase, downloaded, total);
                }, || manager.cancellation_requested(&job_id)),
                Err(error) => Err(error),
            }
        } else {
            match ensure_runtime_dir() {
                Ok(root) => vllm_installer::install(root, |phase, downloaded, total| {
                    manager.progress(&app, &job_id, phase, downloaded, total);
                }, || manager.cancellation_requested(&job_id)),
                Err(error) => Err(error),
            }
        };
        manager.finish(&app, &job_id, result);
    });
    Ok(id)
}

#[tauri::command]
fn nvidia_gpu_status() -> Result<String, String> {
    let output = Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"])
        .output().map_err(|_| "nvidia-smi is unavailable. Check that NVIDIA drivers are installed.".to_owned())?;
    if !output.status.success() { return Err("nvidia-smi was unable to read GPU memory.".into()); }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn read_engine_log(engine: String) -> Result<String, String> {
    let runtime = runtime_dir()?;
    let paths: Vec<_> = match engine.as_str() {
        "llama.cpp" => vec![("llama.cpp server", runtime.join("logs/llama.log"))],
        "vllm" => vec![
            ("vLLM installer", runtime.join("vllm/install.log")),
            ("vLLM server", runtime.join("logs/vllm.log")),
        ],
        _ => return Err("Unsupported engine log.".into()),
    };
    let mut result = String::new();
    for (title, path) in paths {
        if let Ok(bytes) = fs::read(&path) {
            result.push_str(&format!("=== {title} ({}) ===\n", path.display()));
            // A byte slice may start in the middle of a UTF-8 character: lossy
            // conversion avoids a panic when printing a truncated log tail.
            result.push_str(&String::from_utf8_lossy(&bytes[bytes.len().saturating_sub(16_000)..]));
            result.push_str("\n\n");
        }
    }
    if result.is_empty() { return Err(format!("No log found for {engine}.")); }
    Ok(result)
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct InferenceRuntimeStatus {managed:bool,pid:Option<u32>,context_shift:String}
fn context_shift_evidence(log:&str)->&'static str{
    if log.contains("KV cache shifting is not supported")||log.contains("disabling KV cache shifting"){"unsupported"}
    else if log.contains("KV cache shifting enabled"){"supported"}else{"unknown"}
}
#[cfg(test)]
mod inference_status_tests{
    #[test]fn context_shift_status_requires_actual_runtime_evidence(){
        assert_eq!(super::context_shift_evidence("KV cache shifting is not supported for this context, disabling KV cache shifting"),"unsupported");
        assert_eq!(super::context_shift_evidence("KV cache shifting enabled"),"supported");
        assert_eq!(super::context_shift_evidence("model loaded; --context-shift requested"),"unknown");
    }
}
#[tauri::command]
fn inference_runtime_status(state:State<'_,EngineProcesses>,gguf:String,port:u16)->Result<InferenceRuntimeStatus,String>{
    let model=state.llama_model.lock().map_err(|_|"Model state lock unavailable")?.clone();
    let actual_port=*state.llama_port.lock().map_err(|_|"Port state lock unavailable")?;
    let matches=model.and_then(|m|Path::new(&m).canonicalize().ok()).zip(Path::new(&gguf).canonicalize().ok()).is_some_and(|(a,b)|a==b)&&actual_port==Some(port);
    let mut process=state.llama.lock().map_err(|_|"Process state lock unavailable")?;
    let pid=if matches{if let Some(p)=process.as_mut(){if p.try_wait().map_err(|e|e.to_string())?.is_none(){Some(p.id())}else{None}}else{None}}else{None};
    let evidence=if pid.is_some(){let bytes=fs::read(runtime_dir()?.join("logs/llama.log")).map_err(|e|e.to_string())?;context_shift_evidence(&String::from_utf8_lossy(&bytes)).to_owned()}else{"unknown".into()};
    Ok(InferenceRuntimeStatus{managed:pid.is_some(),pid,context_shift:evidence})
}

#[tauri::command]
fn get_runtime_location() -> Result<String, String> {
    Ok(ensure_runtime_dir()?.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let root = ensure_runtime_dir().expect("runtime directory unavailable");
    // Migrate old numbered llama.cpp installs on startup, without re-downloading.
    // Never delete a failed migration or an existing user's runtime folder.
    if let Err(error) = llama_installer::migrate_legacy_install(&root) {
        eprintln!("Solarium llama.cpp migration skipped: {error}");
    }
    let jobs = InstallJobs::new(root.join("installer/jobs.json"));
    if let Some(server) = llama_installer::find_server(&root.join("llama-cpp"), 0) {
        jobs.repoint_completed_llama_results(&root, &server);
    }
    tauri::Builder::default()
        .manage(EngineProcesses::default())
        .manage(glitch::ProjectService::default())
        .manage(project_services::ProjectServices::default())
        .manage(glitch::WorkspaceWatch::default())
        .manage(glitch_terminal::Terminals::default())
        .manage(jobs)
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            glitch::glitch_workspace_action, glitch::glitch_project_request, glitch::glitch_watch, glitch::glitch_workspace_settings,
            spica_preview::spica_executable_hash, spica_preview::launch_spica_app, spica_preview::run_spica_scenario,
            glitch_terminal::glitch_terminal_create, glitch_terminal::glitch_terminal_read,
            glitch_terminal::glitch_terminal_write, glitch_terminal::glitch_terminal_resize, glitch_terminal::glitch_terminal_kill,
            quality::create_quality_fixture,
            quality::coding_quality_identity,model_load_plan,local_coding_probe,model_download::list_model_download_files,model_download::start_model_download,coding_tools::coding_tool_status,
            project_services::list_project_services,project_services::start_project_service,project_services::inspect_project_service,project_services::stop_project_service,dependency_api::inspect_dependency_api,registered_commands::register_project_command,project_snapshot::project_source_snapshot,project_commands::list_project_commands, project_commands::run_project_command, project_commands::cancel_project_command, project_commands::read_command_output,
            inference_runtime_status, creator::inspect_project_environment, creator::read_research_page,
            foundation::foundation_list, foundation::foundation_body, foundation::foundation_batch,
            start_llama_server, stop_llama_server, start_vllm_server, stop_vllm_server,
            nvidia_gpu_status, read_engine_log,
            start_install_job, get_install_jobs, cancel_install_job,
            get_runtime_location, gguf_catalog::scan_gguf_directory, activate_gguf_model,
            creator::create_project_directory, creator::search_project_code, creator::apply_project_changes, creator::replace_project_text, creator::list_project_files, creator::read_project_file, creator::write_project_file, creator::inspect_generated_file, creator::save_generated_file, creator::run_project_check, creator::run_project_check_stream, creator::search_public_web, creator::read_public_webpage,
        ])
        .build(tauri::generate_context!())
        .expect("failed to initialize Solarium")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                project_services::shutdown(app);
                glitch_terminal::shutdown(app);
                glitch::shutdown(app);
                let engines = app.state::<EngineProcesses>();
                let had_vllm = engines.vllm.lock().is_ok_and(|slot| slot.is_some());
                let _ = stop_managed(&engines.llama, "llama.cpp");
                let _ = stop_managed(&engines.vllm, "vLLM (WSL2)");
                #[cfg(windows)] {
                    if had_vllm { let _ = Command::new("wsl.exe").args(["--terminate", vllm_installer::DISTRO]).status(); }
                }
                #[cfg(not(windows))] let _ = had_vllm;
            }
        });
}

