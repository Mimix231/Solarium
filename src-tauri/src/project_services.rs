//! Managed development processes. Original stdout/stderr use the same scoped paged logs as checks.
use std::{collections::HashMap,fs,path::PathBuf,process::{Child,Stdio},sync::Mutex,time::{Duration,SystemTime,UNIX_EPOCH}};
use serde::Serialize;
use tauri::{Manager,State};
struct Service {root:PathBuf,child:Child,url:Option<String>,exit_code:Option<i32>,#[cfg(windows)]job:Option<crate::windows_job::JobObject>}
#[derive(Default)]pub struct ProjectServices {items:Mutex<HashMap<String,Service>>}
impl Drop for ProjectServices{fn drop(&mut self){if let Ok(items)=self.items.get_mut(){for service in items.values_mut(){let _=service.child.kill();let _=service.child.wait();}}}}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct ServiceStatus {id:String,pid:u32,state:String,url:Option<String>,http_status:Option<u16>,exit_code:Option<i32>,stdout:String,stderr:String,source:String}
fn url(value:Option<String>)->Result<Option<String>,String>{value.map(|s|{let parsed=reqwest::Url::parse(&s).map_err(|e|e.to_string())?;if parsed.scheme()!="http"||!["127.0.0.1","localhost","[::1]"].contains(&parsed.host_str().unwrap_or(""))||!parsed.username().is_empty()||parsed.password().is_some()||parsed.fragment().is_some()||parsed.port_or_known_default().unwrap_or(0)<1024{return Err("Preview URL must be an uncredentialled loopback HTTP URL with a development port".into())}Ok(parsed.to_string())}).transpose()}
#[tauri::command]
pub fn start_project_service(app:tauri::AppHandle,state:State<'_,ProjectServices>,root:String,command_id:String,ready_url:Option<String>,web_enabled:bool)->Result<String,String>{
    let base=crate::creator::safe_root(&root)?;let spec=crate::registered_commands::catalogue(&app,&base)?.into_iter().find(|s|s.id==command_id).ok_or("Unknown project command")?;if !spec.service{return Err("Select a registered service command".into())}if spec.network&&!web_enabled{return Err("Web Search is OFF; this service command requests network setup".into())}
    let ready=url(ready_url)?;if let Some(ref ready)=ready{let parsed=reqwest::Url::parse(ready).map_err(|e|e.to_string())?;if std::net::TcpStream::connect_timeout(&format!("127.0.0.1:{}",parsed.port().unwrap_or(80)).parse().map_err(|e|format!("Invalid preview port: {e}"))?,Duration::from_millis(200)).is_ok(){return Err("The preview port is already occupied; choose a free port without stopping unrelated processes".into())}}
    let id=format!("service-{}-{}",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos());let logs=crate::project_commands::logs(&app)?;let meta=crate::project_commands::LogOwner{root:base.to_string_lossy().into_owned(),command_id:spec.id.clone()};fs::write(logs.join(format!("{id}.json")),serde_json::to_vec(&meta).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    let cwd=base.join(&spec.cwd).canonicalize().map_err(|e|e.to_string())?;if !cwd.starts_with(&base){return Err("Service working directory escaped its project".into())}let mut command=crate::project_commands::process(&spec);command.current_dir(cwd).stdin(Stdio::null()).stdout(Stdio::from(fs::File::create(logs.join(format!("{id}.stdout"))).map_err(|e|e.to_string())?)).stderr(Stdio::from(fs::File::create(logs.join(format!("{id}.stderr"))).map_err(|e|e.to_string())?));let mut child=command.spawn().map_err(|e|format!("Cannot start project service: {e}"))?;
    #[cfg(windows)]let job={let job=crate::windows_job::JobObject::create()?;if let Err(error)=job.attach(&child){let _=child.kill();let _=child.wait();return Err(error)}Some(job)};
    state.items.lock().map_err(|e|e.to_string())?.insert(id.clone(),Service{root:base,child,url:ready,exit_code:None,#[cfg(windows)]job});Ok(id)
}
#[tauri::command]
pub async fn inspect_project_service(app:tauri::AppHandle,root:String,service_id:String)->Result<ServiceStatus,String>{
    tauri::async_runtime::spawn_blocking(move||{
        let base=crate::creator::safe_root(&root)?;let state=app.state::<ProjectServices>();let (pid,alive,exit_code,ready)={let mut items=state.items.lock().map_err(|e|e.to_string())?;let item=items.get_mut(&service_id).ok_or("Project service is unavailable; a restarted app never adopts an unknown PID")?;if item.root!=base{return Err("This service belongs to a different project".into())}let exit=item.child.try_wait().map_err(|e|e.to_string())?;if let Some(exit)=exit{item.exit_code=exit.code();} (item.child.id(),exit.is_none(),item.exit_code,item.url.clone())};
        let logs=crate::project_commands::logs(&app)?;let (stdout,_)=crate::project_commands::tail(&logs.join(format!("{service_id}.stdout")));let (stderr,_)=crate::project_commands::tail(&logs.join(format!("{service_id}.stderr")));let http_status=if alive{ready.as_ref().and_then(|u|reqwest::blocking::Client::builder().timeout(Duration::from_secs(2)).build().ok()?.get(u).send().ok().map(|r|r.status().as_u16()))}else{None};
        Ok(ServiceStatus{id:service_id,pid,state:if !alive{"exited"}else if http_status.is_some_and(|s|s<400){"ready"}else if ready.is_some(){"starting"}else{"running"}.into(),url:ready,http_status,exit_code,stdout,stderr,source:"Actual managed process, native output logs and loopback HTTP response; this is not browser behaviour verification".into()})
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn list_project_services(app:tauri::AppHandle,root:String)->Result<Vec<ServiceStatus>,String>{
    let base=crate::creator::safe_root(&root)?;let ids={let state=app.state::<ProjectServices>();let items=state.items.lock().map_err(|e|e.to_string())?;items.iter().filter(|(_,s)|s.root==base).map(|(id,_)|id.clone()).collect::<Vec<_>>()};let mut result=Vec::new();for id in ids{result.push(inspect_project_service(app.clone(),root.clone(),id).await?);}Ok(result)
}
#[tauri::command]
pub fn stop_project_service(state:State<'_,ProjectServices>,root:String,service_id:String)->Result<(),String>{let base=crate::creator::safe_root(&root)?;let mut items=state.items.lock().map_err(|e|e.to_string())?;let item=items.get_mut(&service_id).ok_or("Project service is not available")?;if item.root!=base{return Err("This service belongs to a different project".into())}let _=item.child.kill();let status=item.child.wait().map_err(|e|e.to_string())?;item.exit_code=status.code();#[cfg(windows)]{item.job.take();}Ok(())}
pub fn shutdown(app:&tauri::AppHandle){let state=app.state::<ProjectServices>();if let Ok(mut items)=state.items.lock(){for item in items.values_mut(){let _=item.child.kill();let _=item.child.wait();#[cfg(windows)]{item.job.take();}}};}
#[cfg(test)]mod tests{use super::*;#[test]fn preview_urls_never_target_remote_or_credentialled_endpoints(){for value in ["https://example.com","http://127.0.0.1:80","http://user:password@127.0.0.1:3000","file:///local"]{assert!(url(Some(value.into())).is_err());}assert!(url(Some("http://127.0.0.1:3555/".into())).is_ok());}}
