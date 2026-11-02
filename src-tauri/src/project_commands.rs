//! Real, scoped project commands. The catalogue is rebuilt from the current
//! manifests before execution; models select an ID, never an arbitrary shell.
use std::{collections::HashMap, fs, io::{Read, Write}, path::{Path, PathBuf}, process::{Command, Stdio}, sync::{Arc, Mutex, OnceLock, atomic::{AtomicBool, Ordering}}, time::{Duration, Instant}};
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ProjectCommand { pub id:String, pub command:String, pub purpose:String, pub verification:bool, pub cwd:String, pub(crate) program:String, pub(crate) args:Vec<String>, pub service:bool, pub network:bool, pub behavioral:bool }
fn entry(id:&str, program:&str, args:Vec<String>, purpose:&str, verification:bool)->ProjectCommand {
    ProjectCommand{id:id.into(),command:format!("{} {}",program,args.join(" ")),purpose:purpose.into(),verification,cwd:".".into(),program:program.into(),args,service:false,network:false,behavioral:id.contains("test")||id.ends_with(":verify")}
}
fn words(items:&[&str])->Vec<String>{items.iter().map(|s|s.to_string()).collect()}
fn valid_script(name:&str)->bool{!name.is_empty()&&name.len()<150&&name.chars().all(|c|c.is_ascii_alphanumeric()||"_:-.".contains(c))}
pub fn catalogue(base:&Path)->Result<Vec<ProjectCommand>,String>{
    let mut out=Vec::new();
    if base.join("package.json").is_file(){
        let manifest=crate::creator::safe_file(&base.to_string_lossy(),"package.json")?;
        let pkg:serde_json::Value=serde_json::from_str(&fs::read_to_string(manifest).map_err(|e|e.to_string())?).map_err(|e|format!("package.json: {e}"))?;
        let pm=if base.join("pnpm-lock.yaml").exists(){"pnpm"}else if base.join("yarn.lock").exists(){"yarn"}else if base.join("bun.lock").exists()||base.join("bun.lockb").exists(){"bun"}else{"npm"};
        if let Some(scripts)=pkg["scripts"].as_object(){for (name,body) in scripts {
            if !valid_script(name){continue;}
            let Some(body)=body.as_str() else{continue;};
            // Interactive/watch commands need a separate server lifecycle. Do
            // not accidentally call one a check or leave it running forever.
            if ["dev","start","serve","watch","preview","tauri","desktop:dev"].contains(&name.as_str())||body.contains("--watch"){let mut service=entry(&format!("service:{name}"),pm,words(&["run",name]),body,false);service.service=true;out.push(service);continue;}
            if name.starts_with("pre")||name.starts_with("post"){continue;}
            let verify=["test","check","lint","build","typecheck","validate","verify"].iter().any(|p|name==*p||name.starts_with(&format!("{p}:"))||name.ends_with(&format!(":{p}")));
            out.push(entry(&format!("script:{name}"),pm,words(&["run",name]),&format!("package.json scripts.{name}: {body}"),verify));
        }}
        out.push(entry("install:cached",pm,if pm=="npm"{words(&["install","--offline","--ignore-scripts","--no-audit","--no-fund"])}else if pm=="yarn"{words(&["install","--offline","--ignore-scripts"])}else if pm=="pnpm"{words(&["install","--offline","--ignore-scripts"])}else{words(&["install","--offline","--ignore-scripts"])},"Install from the local cache with lifecycle scripts disabled",false));
        out.push(entry("install:network",pm,if pm=="npm"{words(&["install","--ignore-scripts","--no-audit","--no-fund"])}else{words(&["install","--ignore-scripts"])},"Install dependencies with lifecycle scripts disabled (requires Web ON)",false));
    }
    for manifest in ["Cargo.toml","src-tauri/Cargo.toml"] {if base.join(manifest).is_file(){
        crate::creator::safe_file(&base.to_string_lossy(),manifest)?;
        let prefix=if manifest=="Cargo.toml"{"cargo"}else{"tauri"};
        for (kind,tail) in [("check",vec!["check"]),("test",vec!["test"]),("build",vec!["build"]),("fmt",vec!["fmt"]),("clippy",vec!["clippy"])]{
            let mut args=words(&tail);args.extend(words(&["--manifest-path",manifest]));
            if kind=="fmt"{args.extend(words(&["--","--check"]));}
            out.push(entry(&format!("{prefix}:{kind}"),"cargo",args,"Rust manifest verification",true));
        }
    }}
    if base.join("pyproject.toml").is_file()||base.join("pytest.ini").is_file()||base.join("requirements.txt").is_file(){
        out.push(entry("python:test","python",words(&["-m","pytest"]),"Run the project's pytest suite",true));
    }
    if base.join(".git").exists(){out.push(entry("git:status","git",words(&["status","--short"]),"Inspect working tree",false));out.push(entry("git:diff","git",words(&["diff","--stat"]),"Inspect changes",false));}
    Ok(out)
}
#[tauri::command]
pub fn list_project_commands(app:tauri::AppHandle,root:String)->Result<Vec<ProjectCommand>,String>{crate::registered_commands::catalogue(&app,&crate::creator::safe_root(&root)?)}

#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct LogOwner {pub root:String,pub command_id:String}
#[derive(Serialize)]
pub struct CommandResult { pub command:String,pub exit_code:Option<i32>,pub stdout:String,pub stderr:String,pub timed_out:bool,pub cancelled:bool,pub run_id:String,pub command_id:String,pub output_complete:bool,pub duration_ms:u128, pub source_before:String,pub source_after:String,pub verification:bool }
type Running=Mutex<HashMap<String,Arc<AtomicBool>>>;
static RUNNING:OnceLock<Running>=OnceLock::new();
fn running()->&'static Running{RUNNING.get_or_init(||Mutex::new(HashMap::new()))}
fn valid_id(id:&str)->bool{!id.is_empty()&&id.len()<100&&id.chars().all(|c|c.is_ascii_alphanumeric()||c=='-')}
pub(crate) fn logs(app:&tauri::AppHandle)->Result<PathBuf,String>{let dir=app.path().app_local_data_dir().map_err(|e|e.to_string())?.join("command-logs");fs::create_dir_all(&dir).map_err(|e|e.to_string())?;Ok(dir)}
fn key(root:&Path,id:&str)->String{format!("{}|{id}",root.display())}
#[tauri::command]
pub fn cancel_project_command(root:String,run_id:String)->Result<bool,String>{
    let root=crate::creator::safe_root(&root)?;let guard=running().lock().map_err(|e|e.to_string())?;
    if let Some(cancel)=guard.get(&key(&root,&run_id)){cancel.store(true,Ordering::SeqCst);return Ok(true);}Ok(false)
}

/// A Tauri dev instance passes these to its own build, not to projects it edits.
pub fn clean_environment(command:&mut Command){
    for (name,_) in std::env::vars(){if name=="TAURI_CONFIG"||name.starts_with("TAURI_ENV_")||name.starts_with("CARGO_PKG_")||name=="CARGO_MANIFEST_DIR"{command.env_remove(name);}}
    #[cfg(windows)]{use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
}
pub(crate) fn process(spec:&ProjectCommand)->Command{
    #[cfg(windows)] let mut cmd=if ["npm","pnpm","yarn"].contains(&spec.program.as_str()){let mut c=Command::new("cmd.exe");c.args(["/d","/s","/c",&format!("{}.cmd",spec.program)]);c}else{Command::new(&spec.program)};
    #[cfg(not(windows))] let mut cmd=Command::new(&spec.program);
    cmd.args(&spec.args);clean_environment(&mut cmd);cmd
}
fn pump(mut pipe:impl Read+Send+'static,path:PathBuf,stream:&'static str,channel:tauri::ipc::Channel<crate::creator::ProjectCheckStreamEvent>)->std::thread::JoinHandle<Result<(),String>>{
    std::thread::spawn(move||{let mut file=fs::File::create(path).map_err(|e|e.to_string())?;let mut buffer=[0u8;4096];loop{let n=pipe.read(&mut buffer).map_err(|e|e.to_string())?;if n==0{break;}file.write_all(&buffer[..n]).map_err(|e|e.to_string())?;let _=channel.send(crate::creator::ProjectCheckStreamEvent{stream:stream.into(),chunk:String::from_utf8_lossy(&buffer[..n]).into_owned()});}file.sync_all().map_err(|e|e.to_string())})
}
pub(crate) fn tail(path:&Path)->(String,bool){use std::io::{Seek,SeekFrom};let Ok(mut file)=fs::File::open(path)else{return(String::new(),true)};let size=file.metadata().map(|m|m.len()).unwrap_or(0);let _=file.seek(SeekFrom::Start(size.saturating_sub(24000)));let mut bytes=Vec::new();let _=file.read_to_end(&mut bytes);(String::from_utf8_lossy(&bytes).into_owned(),size<=24000)}
fn complete_utf8_prefix(bytes:&[u8])->usize{match std::str::from_utf8(bytes){Ok(_)=>bytes.len(),Err(error)if error.error_len().is_none()=>error.valid_up_to(),Err(_)=>bytes.len()}}
#[tauri::command]
pub async fn run_project_command(app:tauri::AppHandle,root:String,command_id:String,run_id:String,web_enabled:bool,timeout_seconds:Option<u64>,on_event:tauri::ipc::Channel<crate::creator::ProjectCheckStreamEvent>)->Result<CommandResult,String>{
    if !valid_id(&run_id){return Err("Invalid command run ID".into());}
    let base=crate::creator::safe_root(&root)?;
    let spec=crate::registered_commands::catalogue(&app,&base)?.into_iter().find(|c|c.id==command_id).ok_or("Command is not declared by this project's current manifests. Inspect its command catalogue.")?;
    if (command_id=="install:network"||spec.network)&&!web_enabled{return Err("Web Search is OFF: use install:cached".into());}
    if spec.service{return Err("This is a long-running command. Use start_project_service and its managed lifecycle.".into())}
    let source_before=crate::project_snapshot::snapshot(&base)?.sha256;
    let directory=logs(&app)?;let meta=directory.join(format!("{run_id}.json"));
    // create_new prevents overwriting any previous task's evidence.
    let mut file=fs::OpenOptions::new().create_new(true).write(true).open(&meta).map_err(|e|format!("Cannot allocate command evidence: {e}"))?;
    serde_json::to_writer(&mut file,&LogOwner{root:base.to_string_lossy().into_owned(),command_id:command_id.clone()}).map_err(|e|e.to_string())?;
    let cancel=Arc::new(AtomicBool::new(false));let run_key=key(&base,&run_id);running().lock().map_err(|e|e.to_string())?.insert(run_key.clone(),cancel.clone());
    let result=tauri::async_runtime::spawn_blocking(move||{
        let started=Instant::now();let timeout=Duration::from_secs(timeout_seconds.unwrap_or(600).clamp(1,3600));
        let cwd=base.join(&spec.cwd).canonicalize().map_err(|e|e.to_string())?;if !cwd.starts_with(&base){return Err("Command working directory escaped the project".into())}let mut command=process(&spec);if spec.program=="cargo"&&!web_enabled&&!spec.args.iter().any(|a|a=="--offline"){command.arg("--offline");}command.current_dir(&cwd).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child=command.spawn().map_err(|e|format!("Could not execute {}: {e}. Check the installed toolchain/PATH.",spec.command))?;
        #[cfg(windows)] let job={let job=crate::windows_job::JobObject::create()?;if let Err(e)=job.attach(&child){let _=child.kill();let _=child.wait();return Err(e);}job};
        let stdout_path=directory.join(format!("{run_id}.stdout"));let stderr_path=directory.join(format!("{run_id}.stderr"));
        let stdout=pump(child.stdout.take().ok_or("stdout unavailable")?,stdout_path.clone(),"stdout",on_event.clone());
        let stderr=pump(child.stderr.take().ok_or("stderr unavailable")?,stderr_path.clone(),"stderr",on_event);
        let mut timed_out=false;let mut cancelled=false;
        let exit=loop{if cancel.load(Ordering::SeqCst)||started.elapsed()>=timeout{cancelled=cancel.load(Ordering::SeqCst);timed_out=!cancelled;let _=child.kill();let status=child.wait().map_err(|e|e.to_string())?;break status;}if let Some(status)=child.try_wait().map_err(|e|e.to_string())?{break status;}std::thread::sleep(Duration::from_millis(50));};
        #[cfg(windows)] drop(job); // also closes any descendants still holding pipes
        stdout.join().map_err(|_|"stdout reader panicked")??;stderr.join().map_err(|_|"stderr reader panicked")??;
        let (out,out_complete)=tail(&stdout_path);let (err,err_complete)=tail(&stderr_path);
        Ok(CommandResult{command:spec.command,exit_code:exit.code(),stdout:out,stderr:err,timed_out,cancelled,run_id,command_id,output_complete:out_complete&&err_complete,duration_ms:started.elapsed().as_millis(),source_before,source_after:crate::project_snapshot::snapshot(&base)?.sha256,verification:spec.verification})
    }).await.map_err(|e|e.to_string());
    running().lock().map_err(|e|e.to_string())?.remove(&run_key);result?
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct OutputPage {text:String,offset:u64,next_offset:u64,total_bytes:u64,has_more:bool}
#[tauri::command]
pub fn read_command_output(app:tauri::AppHandle,root:String,run_id:String,stream:String,offset:u64)->Result<OutputPage,String>{
    use std::io::{Seek,SeekFrom};
    if !valid_id(&run_id)||!["stdout","stderr"].contains(&stream.as_str()){return Err("Invalid output locator".into());}
    let base=crate::creator::safe_root(&root)?;let dir=logs(&app)?;let meta:LogOwner=serde_json::from_slice(&fs::read(dir.join(format!("{run_id}.json"))).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    if meta.root!=base.to_string_lossy(){return Err("Command output belongs to another project".into());}
    let mut file=fs::File::open(dir.join(format!("{run_id}.{stream}"))).map_err(|e|e.to_string())?;let total=file.metadata().map_err(|e|e.to_string())?.len();if offset>total{return Err("Output offset exceeds file length".into());}
    file.seek(SeekFrom::Start(offset)).map_err(|e|e.to_string())?;let mut bytes=Vec::new();file.take(12000).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
    // Leave an incomplete final codepoint for the next page. A client following
    // nextOffset can reconstruct valid UTF-8 output exactly across boundaries.
    let boundary=if offset+bytes.len() as u64==total{bytes.len()}else{complete_utf8_prefix(&bytes)};bytes.truncate(boundary);
    let next=offset+bytes.len() as u64;Ok(OutputPage{text:String::from_utf8_lossy(&bytes).into_owned(),offset,next_offset:next,total_bytes:total,has_more:next<total})
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn catalogue_uses_real_scripts_and_never_shell_arguments(){let dir=std::env::temp_dir().join(format!("solarium-commands-{}",std::process::id()));fs::create_dir_all(&dir).unwrap();fs::write(dir.join("package.json"),r#"{"scripts":{"test:unit":"node --test","check":"tsc","dev":"vite","bad&name":"echo bad"}}"#).unwrap();let commands=catalogue(&dir).unwrap();assert!(commands.iter().any(|c|c.id=="script:test:unit"&&c.verification));assert!(commands.iter().any(|c|c.id=="service:dev"&&c.service));assert!(!commands.iter().any(|c|c.id.contains('&')));fs::remove_file(dir.join("package.json")).unwrap();fs::remove_dir(dir).unwrap();}
    #[test]fn output_pages_retain_split_unicode_codepoints(){let bytes="ab🌞é".as_bytes();assert_eq!(complete_utf8_prefix(&bytes[..4]),2);assert_eq!(complete_utf8_prefix(&bytes[..6]),6);assert_eq!(complete_utf8_prefix(bytes),bytes.len());}
}
