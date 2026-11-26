//! Creator workspace: explicit local file access and opt-in public web retrieval.
use std::fs;
use std::io::Read;
use std::net::{IpAddr, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct ProjectInspection { files: Vec<String>, file_count: usize, root_entry_count: usize, truncated: bool, manifests: Vec<Manifest>, has_git: bool, dependencies_installed: bool, errors: Vec<String> }
#[derive(Serialize)]
struct Manifest { path:String, content:String }
#[tauri::command]
pub fn inspect_project_environment(root:String)->Result<ProjectInspection,String>{
    let base=safe_root(&root)?;
    let root_entry_count=fs::read_dir(&base).map_err(|e|e.to_string())?.count();
    let files=list_project_files(root.clone())?;
    let mut manifests=Vec::new();let mut errors=Vec::new();
    for path in ["package.json","Cargo.toml","src-tauri/Cargo.toml","tsconfig.json","src-tauri/tauri.conf.json","tauri.conf.json"] {
        if files.iter().any(|f|f==path){match read_project_file(root.clone(),path.into()){Ok(content)=>manifests.push(Manifest{path:path.into(),content}),Err(e)=>errors.push(e)}}
    }
    Ok(ProjectInspection{file_count:files.len(),truncated:files.len()>=500,files,root_entry_count,manifests,has_git:base.join(".git").exists(),dependencies_installed:base.join("node_modules").is_dir(),errors})
}

#[derive(serde::Deserialize)]
pub struct SearchProviderConfig {kind:String,endpoint:Option<String>}
fn search_duckduckgo(query:String)->Result<Vec<WebResult>,String>{
    use scraper::{Html,Selector};
    if query.trim().is_empty()||query.len()>300{return Err("Search query must contain 1–300 characters".into());}
    let mut url=reqwest::Url::parse("https://html.duckduckgo.com/html/").map_err(|e|e.to_string())?;url.query_pairs_mut().append_pair("q",&query);
    let (url,ips)=public_https(url.as_str())?;let mut response=client_for(&url,&ips)?.get(url.clone()).send().map_err(|e|e.to_string())?;
    if response.status()!=reqwest::StatusCode::OK{return Err(format!("DuckDuckGo search unavailable ({}); no challenge was bypassed",response.status()));}
    let mut bytes=Vec::new();response.by_ref().take(500_001).read_to_end(&mut bytes).map_err(|e|e.to_string())?;if bytes.len()>500_000{return Err("Search response exceeds size limit".into());}
    let html=Html::parse_document(&String::from_utf8_lossy(&bytes));let result_selector=Selector::parse(".result").map_err(|e|e.to_string())?;let link_selector=Selector::parse(".result__a").map_err(|e|e.to_string())?;let snippet_selector=Selector::parse(".result__snippet").map_err(|e|e.to_string())?;
    let mut results=Vec::new();for result in html.select(&result_selector){let Some(anchor)=result.select(&link_selector).next()else{continue;};let Some(href)=anchor.value().attr("href")else{continue;};let Ok(link)=url.join(href)else{continue;};let destination=if link.host_str().is_some_and(|h|h.ends_with("duckduckgo.com")){link.query_pairs().find(|(k,_)|k=="uddg").map(|(_,v)|v.into_owned())}else{Some(link.to_string())};let Some(destination)=destination else{continue;};if public_https(&destination).is_err(){continue;}
        results.push(WebResult{title:anchor.text().collect::<Vec<_>>().join(" "),url:destination,excerpt:result.select(&snippet_selector).next().map(|s|s.text().collect::<Vec<_>>().join(" ")).unwrap_or_default()});if results.len()>=12{break;}
    }if results.is_empty(){return Err("DuckDuckGo returned no readable search results; it may require interactive verification.".into());}Ok(results)
}
fn search_searxng(query:String,endpoint:String)->Result<Vec<WebResult>,String>{
    if query.trim().is_empty()||query.len()>300{return Err("Search query must contain 1–300 characters".into());}
    let (mut url,_)=public_https(&endpoint)?;url.set_path(&format!("{}/search",url.path().trim_end_matches('/')));
    url.query_pairs_mut().clear().append_pair("q",&query).append_pair("format","json");
    let (url,ips)=public_https(url.as_str())?;
    let mut response=client_for(&url,&ips)?.get(url).send().map_err(|e|e.to_string())?.error_for_status().map_err(|e|format!("SearXNG unavailable (JSON output must be enabled): {e}"))?;
    let mut bytes=Vec::new();response.by_ref().take(500_001).read_to_end(&mut bytes).map_err(|e|e.to_string())?;if bytes.len()>500_000{return Err("Search response exceeds size limit".into());}
    let json:serde_json::Value=serde_json::from_slice(&bytes).map_err(|_|"SearXNG did not return JSON. Enable JSON output in its configuration.")?;
    Ok(json["results"].as_array().ok_or("SearXNG results missing")?.iter().take(20).filter_map(|r|{let url=r["url"].as_str()?;if public_https(url).is_err(){return None;}Some(WebResult{url:url.into(),title:r["title"].as_str().unwrap_or(url).into(),excerpt:r["content"].as_str().unwrap_or("").chars().take(1200).collect()})}).collect())
}

fn search_mwmbl(query: String) -> Result<Vec<WebResult>, String> {
    let query = query.trim();
    if query.is_empty() || query.len() > 300 {
        return Err("Search query must contain 1–300 characters.".into());
    }
    let mut url = reqwest::Url::parse("https://api.mwmbl.org/api/v2/search/").map_err(|e| e.to_string())?;
    url.query_pairs_mut().append_pair("q", query);
    let (url, ips) = public_https(url.as_str())?;
    let client = client_for(&url, &ips)?;
    // The anonymous API allows one request per second per IP.
    static LAST_SEARCH: Mutex<Option<Instant>> = Mutex::new(None);
    {
        let mut last = LAST_SEARCH.lock().map_err(|_| "Mwmbl search scheduler is unavailable.")?;
        if let Some(previous) = *last {
            std::thread::sleep(Duration::from_secs(1).saturating_sub(previous.elapsed()));
        }
        *last = Some(Instant::now());
    }
    let mut response = client.get(url).header(reqwest::header::ACCEPT, "application/json")
        .send().map_err(|e| format!("Mwmbl search unavailable: {e}"))?;
    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("Mwmbl's anonymous search limit was reached. Try another provider or use a known public URL.".into());
    }
    response.error_for_status_ref().map_err(|e| format!("Mwmbl search unavailable: {e}"))?;
    let mut bytes = Vec::new();
    response.by_ref().take(500_001).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() > 500_000 {
        return Err("Search response exceeds size limit.".into());
    }
    parse_mwmbl_results(&bytes)
}

fn parse_mwmbl_results(bytes: &[u8]) -> Result<Vec<WebResult>, String> {
    let json: serde_json::Value = serde_json::from_slice(bytes).map_err(|_| "Mwmbl did not return JSON.")?;
    let results = json["results"].as_array().ok_or("Mwmbl search results missing.")?;
    Ok(results.iter().take(20).filter_map(|result| {
        let url = result["url"].as_str()?;
        let title = result["title"].as_str()?.trim();
        if title.is_empty() || public_https(url).is_err() { return None; }
        Some(WebResult {
            title: title.chars().take(240).collect(),
            url: url.to_owned(),
            excerpt: result["content"].as_str().unwrap_or_default().trim().chars().take(1200).collect(),
        })
    }).collect())
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct ResearchPage {url:String,title:String,text:String,retrieved_at:String,content_hash:String,locator:String,links:Vec<PageLink>}
#[derive(Serialize)]
pub struct PageLink {url:String,title:String}
fn fetch_readable(url:&str, story_reference:bool)->Result<(String,String,String,Vec<PageLink>),String>{
    use scraper::{Html,Selector};
    let mut current=url.to_owned();
    for _ in 0..5 {
        let (url,ips)=public_https(&current)?;let mut response=client_for(&url,&ips)?.get(url.clone()).send().map_err(|e|e.to_string())?;
        if response.status().is_redirection(){let next=response.headers().get(reqwest::header::LOCATION).and_then(|h|h.to_str().ok()).ok_or("Redirect has no location")?;current=url.join(next).map_err(|e|e.to_string())?.to_string();continue;}
        let response_status=response.status();if !response_status.is_success(){return Err(format!("Page unavailable: {response_status}"));}
        let mime=response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|h|h.to_str().ok()).unwrap_or("").to_owned();
        if !mime.contains("text/html")&&!mime.contains("text/plain"){return Err("Reader supports HTML or plain text only".into());}
        let mut bytes=Vec::new();response.by_ref().take(2_000_001).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
        if bytes.len()>2_000_000{return Err("Page exceeds 2 MB reader limit".into());}
        let raw=String::from_utf8_lossy(&bytes);
        if mime.contains("text/plain"){return Ok((current.clone(),current,raw.into_owned(),Vec::new()));}
        let document=Html::parse_document(&raw);let title=document.select(&Selector::parse("h1, title").map_err(|e|e.to_string())?).next().map(|e|e.text().collect::<String>()).unwrap_or_else(||current.clone());
        let content_selector=Selector::parse(".entry-content, article, main, body").map_err(|e|e.to_string())?;
        let story_roots = ["[itemprop=articleBody]", ".chapter-content", ".p-novel__body"];
        let regular_roots = [".entry-content", "article", "main", "body"];
        let preferred = story_roots.iter().filter(|_| story_reference).chain(regular_roots.iter())
            .find_map(|tag| document.select(&Selector::parse(tag).ok()?).next());
        let mut lines=Vec::new();
        if story_reference && preferred.as_ref().is_some_and(|root| matches!(root.value().name(), "main" | "body")) {
            let synopsis = document.select(&Selector::parse(".p-novel__summary, div[itemprop=description], .synopsis").map_err(|e|e.to_string())?)
                .next().map(|element| element.text().collect::<Vec<_>>().join(" "));
            let description = synopsis.filter(|text| !text.trim().is_empty()).or_else(|| {
                let tags = Selector::parse("meta[name=description],meta[property='og:description']").ok()?;
                document.select(&tags).find_map(|element| element.value().attr("content").map(str::to_owned))
            });
            if let Some(description) = description { lines.push(description.trim().to_owned()); }
        }
        if let Some(root)=preferred.or_else(||document.select(&content_selector).next()){
            for node in root.select(&Selector::parse("h1,h2,h3,p,li,pre").map_err(|e|e.to_string())?){
                if node.ancestors().filter_map(scraper::ElementRef::wrap).any(|e| {
                    let element = e.value();
                    matches!(element.name(),"nav"|"footer"|"script"|"style"|"noscript") || element.attr("id")==Some("comments") ||
                        story_reference && (element.name()=="aside" || element.attr("class").is_some_and(|classes|
                            classes.split_whitespace().any(|class| ["comment", "impression", "pagination", "postscript"].iter().any(|label| class.contains(*label)))))
                }){continue;}
                let text=node.text().collect::<Vec<_>>().join(" ").split_whitespace().collect::<Vec<_>>().join(" ");if !text.is_empty(){lines.push(text);}
            }
        }
        let mut links=Vec::new();for a in document.select(&Selector::parse("a[href]").map_err(|e|e.to_string())?){let Some(href)=a.value().attr("href")else{continue;};let Ok(mut target)=url.join(href)else{continue;};target.set_fragment(None);if target.origin()!=url.origin()||target.scheme()!="https"{continue;}let title=a.text().collect::<Vec<_>>().join(" ").split_whitespace().collect::<Vec<_>>().join(" ");if title.is_empty()||links.iter().any(|l:&PageLink|l.url==target.as_str()){continue;}links.push(PageLink{url:target.into(),title});if links.len()>=300{break;}}
        return Ok((current,title,lines.join("\n\n"),links));
    }
    Err("Too many redirects".into())
}
#[tauri::command]
pub async fn read_research_page(url:String,query:String,web_enabled:bool,story_reference:Option<bool>)->Result<ResearchPage,String>{
    if !web_enabled{return Err("Web Search is OFF".into());}
    tauri::async_runtime::spawn_blocking(move||{
        use sha2::{Digest,Sha256};
        let story_reference=story_reference.unwrap_or(false);
        let (url,title,body,links)=fetch_readable(&url,story_reference)?;
        let text = if story_reference {
            let length = body.chars().count();
            if length <= 48_000 { body } else {
                let first: String = body.chars().take(32_000).collect();
                let last: String = body.chars().skip(length - 16_000).collect();
                format!("{first}\n\n[… middle of retrieved page omitted …]\n\n{last}")
            }
        } else {
        let terms:Vec<String>=query.to_lowercase().split_whitespace().filter(|t|t.len()>2).map(String::from).collect();
        let mut paragraphs:Vec<(usize,usize,&str)>=body.split("\n\n").enumerate().map(|(i,p)|{let lower=p.to_lowercase();(terms.iter().filter(|t|lower.contains(t.as_str())).count(),i,p)}).collect();
        paragraphs.sort_by(|a,b|b.0.cmp(&a.0));
        let has_matches = paragraphs.first().is_some_and(|paragraph| paragraph.0 > 0);
        let mut selected = Vec::new();
        let mut length = 0;
        for (score, index, paragraph) in paragraphs {
            if length >= 3600 || (has_matches && score == 0) { break; }
            if paragraph.trim().is_empty() { continue; }
            let excerpt: String = paragraph.chars().take((3600 - length).min(1200)).collect();
            length += excerpt.chars().count();
            selected.push((index, excerpt));
        }
        selected.sort_by_key(|(i,_)|*i);
        selected.iter().map(|(i,t)|format!("[paragraph {}] {}",i+1,t)).collect::<Vec<_>>().join("\n\n")
        };
        let content_hash=format!("{:x}",Sha256::digest(text.as_bytes()));
        let timestamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_secs();
        Ok(ResearchPage{url,title:title.clone(),text,retrieved_at:format!("unix:{timestamp}"),content_hash,locator:title,links})
    }).await.map_err(|e|e.to_string())?
}

pub(crate) fn safe_root(root: &str) -> Result<PathBuf, String> {
    let dir = Path::new(root).canonicalize().map_err(|e| format!("Project directory unavailable: {e}"))?;
    if !dir.is_dir() { return Err("The project folder is not a directory.".into()); }
    Ok(dir)
}
pub(crate) fn safe_file(root: &str, relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty() || relative.len() > 1024 { return Err("Invalid file path.".into()); }
    let base = safe_root(root)?;
    let proposed = Path::new(relative);
    if proposed.is_absolute() || proposed.components().any(|c| !matches!(c, std::path::Component::Normal(_))) {
        return Err("Only project-relative paths are accepted.".into());
    }
    let path = base.join(proposed).canonicalize().map_err(|e| e.to_string())?;
    if !path.starts_with(&base) || !path.is_file() { return Err("File is outside the project or not a regular file.".into()); }
    let allowed = ["rs", "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "txt", "css", "html", "py", "toml", "yml", "yaml", "xml", "svg", "c", "h", "cpp", "hpp", "java", "go", "sh", "ps1", "sql", "vue", "svelte", "scss", "sass", "less", "cs", "kt", "swift", "dart", "rb", "php", "lua", "ini", "cfg", "gitignore", "csv", "tex"];
    let ext = path.extension().and_then(|x| x.to_str()).unwrap_or("").to_lowercase();
    if !allowed.contains(&ext.as_str()) && path.file_name().and_then(|x| x.to_str()) != Some(".gitignore") { return Err("This file format is not editable in Solarium.".into()); }
    Ok(path)
}
#[tauri::command]
pub fn list_project_files(root: String) -> Result<Vec<String>, String> {
    let base = safe_root(&root)?;
    let mut found = Vec::new();
    fn walk(base: &Path, path: &Path, depth: usize, out: &mut Vec<String>) {
        if depth > 6 || out.len() >= 500 { return; }
        let Ok(items) = fs::read_dir(path) else { return; };
        for entry in items.flatten() {
            if out.len() >= 500 { break; }
            let Ok(ft) = entry.file_type() else { continue; };
            if ft.is_symlink() { continue; }
            let name = entry.file_name().to_string_lossy().to_string();
            if ft.is_dir() {
                if ["node_modules", ".git", "target", "dist", "build", ".venv", ".next", "runtime"].contains(&name.as_str()) { continue; }
                walk(base, &entry.path(), depth + 1, out);
            } else if ft.is_file() {
                if let Ok(rel) = entry.path().strip_prefix(base) {
                    if let Some(s) = rel.to_str() {
                        if safe_file(base.to_string_lossy().as_ref(), s).is_ok() { out.push(s.replace('\\', "/")); }
                    }
                }
            }
        }
    }
    walk(&base, &base, 0, &mut found);
    found.sort();
    Ok(found)
}
#[tauri::command]
pub fn read_project_file(root: String, relative: String) -> Result<String, String> {
    let path = safe_file(&root, &relative)?;
    if path.metadata().map_err(|e| e.to_string())?.len() > 1_000_000 { return Err("File is larger than the 1 MB editor limit.".into()); }
    fs::read_to_string(path).map_err(|e| format!("Cannot read UTF-8 text file: {e}"))
}
#[tauri::command]
pub fn write_project_file(root: String, relative: String, content: String, expected: String) -> Result<(), String> {
    let path = safe_file(&root, &relative)?;
    if content.len() > 1_000_000 || expected.len() > 1_000_000 { return Err("Editor limit is 1 MB.".into()); }
    let original = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if original != expected { return Err("File changed on disk. Reload it before saving.".into()); }
    // A .solarium.bak file is created on every save; never use raw model edits here.
    let backup = path.with_extension(format!("{}.solarium.bak", path.extension().and_then(|x| x.to_str()).unwrap_or("txt")));
    fs::copy(&path, &backup).map_err(|e| format!("Could not create backup: {e}"))?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct ProjectCheckResult {
    pub command: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
}
/** No shell interpolation or arbitrary command strings. The model can only select a listed check. */
#[tauri::command]
pub async fn run_project_check(root: String, check: String) -> Result<ProjectCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::process::{Command, Stdio};
        use std::thread;
        use std::time::{Instant, SystemTime, UNIX_EPOCH};
        let base = safe_root(&root)?;
        let (program, args): (&str, &[&str]) = match check.as_str() {
            "npm_check" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["run", "check"]),
            "npm_test" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["test"]),
            "npm_build" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["run", "build"]),
            "cargo_check" => ("cargo", &["check", "--manifest-path", if base.join("src-tauri/Cargo.toml").is_file() { "src-tauri/Cargo.toml" } else { "Cargo.toml" }]),
            "npm_install" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["install", "--ignore-scripts", "--no-audit", "--no-fund"]),
            "npm_install_offline" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"]),
            "git_diff" => ("git", &["diff", "--stat"]),
            "git_status" => ("git", &["status", "--short"]),
            _ => return Err("Unsupported check. Choose npm_check, npm_test, npm_build, cargo_check or git_diff.".into()),
        };
        let id = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let log_dir = crate::runtime::ensure_runtime_dir()?.join("logs");
        fs::create_dir_all(&log_dir).map_err(|e| format!("Cannot create runtime logs: {e}"))?;
        let out_path = log_dir.join(format!("solarium-check-{id}-out.log"));
        let err_path = log_dir.join(format!("solarium-check-{id}-err.log"));
        let run = (|| -> Result<ProjectCheckResult, String> {
            let stdout = fs::OpenOptions::new().write(true).create_new(true).open(&out_path).map_err(|e| e.to_string())?;
            let stderr = fs::OpenOptions::new().write(true).create_new(true).open(&err_path).map_err(|e| e.to_string())?;
            let mut command = Command::new(program);
            crate::project_commands::clean_environment(&mut command);
            let mut process = command.args(args).current_dir(&base)
                .stdin(Stdio::null()).stdout(Stdio::from(stdout)).stderr(Stdio::from(stderr))
                .spawn().map_err(|e| format!("Cannot execute {program}: {e}"))?;
            let started = Instant::now();
            let (status, timed_out) = loop {
                if let Some(status) = process.try_wait().map_err(|e| e.to_string())? { break (status.code(), false); }
                if started.elapsed() > Duration::from_secs(180) {
                    let _ = process.kill(); let _ = process.wait(); break (None, true);
                }
                thread::sleep(Duration::from_millis(120));
            };
            let clipped = |path: &Path| -> String {
                match fs::read(path) {
                    Ok(mut bytes) => {
                        if bytes.len() > 80_000 { bytes.truncate(80_000); bytes.extend_from_slice(b"\n[Output truncated at 80 KB]\n"); }
                        String::from_utf8_lossy(&bytes).to_string()
                    },
                    Err(error) => format!("Could not read execution log: {error}"),
                }
            };
            Ok(ProjectCheckResult { command: format!("{} {}", program, args.join(" ")), exit_code: status,
                stdout: clipped(&out_path), stderr: clipped(&err_path), timed_out })
        })();
        let _ = fs::remove_file(&out_path); let _ = fs::remove_file(&err_path);
        run
    }).await.map_err(|e| format!("Check worker failed: {e}"))?
}

#[derive(Serialize)]
pub struct GeneratedFilePreview { pub exists: bool, pub current: String }
fn safe_generated_target(root: &str, relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty() || relative.len() > 1024 { return Err("Invalid project-relative filename.".into()); }
    let base = safe_root(root)?;
    let rel = Path::new(relative);
    if rel.is_absolute() || rel.components().any(|c| !matches!(c, std::path::Component::Normal(_))) { return Err("Path traversal is not permitted.".into()); }
    let filename = rel.file_name().and_then(|x| x.to_str()).ok_or("Filename is not valid UTF-8")?;
    let ext = rel.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
    let allowed = ["rs", "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "txt", "css", "html", "py", "toml", "yml", "yaml", "xml", "svg", "c", "h", "cpp", "hpp", "java", "go", "sh", "ps1", "sql", "vue", "svelte", "scss", "sass", "less", "cs", "kt", "swift", "dart", "rb", "php", "lua", "ini", "cfg", "csv", "tex"];
    if !allowed.contains(&ext.as_str()) && filename != ".gitignore" { return Err("Unsupported source file extension.".into()); }
    let target = base.join(rel);
    // Inspection must not create folders. Validate existing ancestors and permit
    // missing descendants; the reviewed write creates them in the shared writer.
    let mut cursor = base.clone();
    for component in rel.components() {
        cursor.push(component);
        match fs::symlink_metadata(&cursor) {
            Ok(metadata) => {
                let mut linked = metadata.file_type().is_symlink();
                #[cfg(windows)] {
                    use std::os::windows::fs::MetadataExt;
                    linked |= metadata.file_attributes() & 0x400 != 0;
                }
                if linked || !cursor.canonicalize().map_err(|e| e.to_string())?.starts_with(&base) {
                    return Err("Generated source cannot target a symbolic link, junction or foreign folder.".into());
                }
                if cursor != target && !metadata.is_dir() { return Err("A source parent is not a directory.".into()); }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
            Err(error) => return Err(format!("Cannot inspect source parent: {error}")),
        }
    }
    if target.exists() { return safe_file(root, relative); }
    Ok(target)
}
#[tauri::command]
pub fn inspect_generated_file(root: String, relative: String) -> Result<GeneratedFilePreview, String> {
    let target = safe_generated_target(&root, &relative)?;
    if target.exists() {
        let current = fs::read_to_string(&target).map_err(|e| format!("Cannot read existing source: {e}"))?;
        if current.len() > 1_000_000 { return Err("Existing file exceeds the 1 MB editor limit.".into()); }
        Ok(GeneratedFilePreview { exists: true, current })
    } else { Ok(GeneratedFilePreview { exists: false, current: String::new() }) }
}
#[tauri::command]
pub fn save_generated_file(root: String, relative: String, content: String, expected: Option<String>) -> Result<(), String> {
    if content.len() > 1_000_000 { return Err("Generated file exceeds the 1 MB limit.".into()); }
    safe_generated_target(&root, &relative)?;
    apply_project_changes(root, vec![ProjectFileChange { path: relative, content, expected }]).map(|_| ())
}

/// Only a user-selected parent folder may be used to create a new project.
#[tauri::command]
pub fn create_project_directory(parent: String, name: String) -> Result<String, String> {
    let clean = name.trim();
    if clean.is_empty() || clean.len() > 100 || clean == "." || clean == ".." ||
        clean.chars().any(|c| c.is_control() || "<>:\\/?*|\"".contains(c)) || (clean.ends_with('.') || clean.ends_with(' ')) {
        return Err("Choose a valid directory name (without path separators or reserved characters).".into());
    }
    let base = safe_root(&parent)?;
    let target = base.join(clean);
    if target.exists() { return Err("The project directory already exists. Choose Existing Project instead.".into()); }
    fs::create_dir(&target).map_err(|e| format!("Could not create project directory: {e}"))?;
    Ok(target.to_string_lossy().to_string())
}

#[derive(Serialize)]
pub struct CodeMatch { pub path: String, pub line: usize, pub text: String }
#[tauri::command]
pub fn search_project_code(root: String, query: String) -> Result<Vec<CodeMatch>, String> {
    if query.trim().len() < 2 || query.len() > 160 { return Err("Search query must have 2–160 characters.".into()); }
    let needle = query.to_lowercase();
    let mut matches = Vec::new();
    for relative in list_project_files(root.clone())? {
        if matches.len() >= 80 { break; }
        let path = safe_file(&root, &relative)?;
        if path.metadata().map_err(|e| e.to_string())?.len() > 250_000 { continue; }
        let Ok(text) = fs::read_to_string(path) else { continue; };
        for (line, value) in text.lines().enumerate() {
            if value.to_lowercase().contains(&needle) {
                matches.push(CodeMatch { path: relative.clone(), line: line + 1, text: value.chars().take(240).collect() });
                if matches.len() >= 80 { break; }
            }
        }
    }
    Ok(matches)
}

/// Precise reviewed edit for an existing file; the model does not need to
/// copy an entire large source file into its context to change one function.
#[tauri::command]
pub fn replace_project_text(root: String, relative: String, expected_fragment: String, replacement: String) -> Result<usize, String> {
    if expected_fragment.is_empty() || expected_fragment.len() > 200_000 || replacement.len() > 200_000 {
        return Err("The reviewed edit must replace a non-empty fragment below 200KB.".into());
    }
    let old = read_project_file(root.clone(), relative.clone())?;
    let matches = old.matches(&expected_fragment).count();
    if matches != 1 { return Err(format!("Expected code fragment occurs {matches} times; narrow the selection before editing.")); }
    let updated = old.replacen(&expected_fragment, &replacement, 1);
    write_project_file(root, relative, updated, old)?;
    Ok(1)
}

#[derive(serde::Deserialize)]
pub struct ProjectFileChange { pub path: String, pub content: String, pub expected: Option<String> }
#[derive(Serialize)]
pub struct AppliedChange { pub path: String, pub operation: String }

/// Apply reviewed edits after a Tauri frontend approval. Never accept absolute paths,
/// traverse out of the chosen project, follow symlinked directories, or silently overwrite.
#[tauri::command]
pub fn apply_project_changes(root: String, files: Vec<ProjectFileChange>) -> Result<Vec<AppliedChange>, String> {
    if files.is_empty() || files.len() > 12 { return Err("Provide between 1 and 12 files per reviewed change set.".into()); }
    let base = safe_root(&root)?;
    let mut validated = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for change in files {
        if change.path.is_empty() || change.path.len() > 512 || change.content.len() > 1_000_000 { return Err("Invalid filename or file exceeds 1MB.".into()); }
        let rel = Path::new(&change.path);
        if rel.is_absolute() || rel.components().any(|component| !matches!(component, std::path::Component::Normal(_))) { return Err("Only project-relative filenames are permitted.".into()); }
        let filename = rel.file_name().and_then(|x| x.to_str()).ok_or("Invalid filename encoding")?;
        let ext = rel.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
        let allowed = ["rs", "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "txt", "css", "html", "py", "toml", "yml", "yaml", "xml", "svg", "c", "h", "cpp", "hpp", "java", "go", "sh", "ps1", "sql", "vue", "svelte", "scss", "sass", "less", "cs", "kt", "swift", "dart", "rb", "php", "lua", "ini", "cfg", "csv", "tex"];
        if !allowed.contains(&ext.as_str()) && filename != ".gitignore" { return Err(format!("Unsupported source file extension: {filename}")); }
        let key = change.path.to_lowercase().replace('\\', "/");
        if !seen.insert(key) { return Err("Duplicated target in change set.".into()); }
        // Verify every existing ancestor of a proposed new file isn't a junction/symlink.
        let mut cursor = base.clone();
        for component in rel.parent().unwrap_or(Path::new("")).components() {
            cursor.push(component);
            if cursor.exists() {
                let metadata = fs::symlink_metadata(&cursor).map_err(|e| e.to_string())?;
                if metadata.file_type().is_symlink() || !metadata.is_dir() || !cursor.canonicalize().map_err(|e| e.to_string())?.starts_with(&base) { return Err("File parent is outside the project or is a symlink.".into()); }
            }
        }
        let target = base.join(rel);
        let original = if target.exists() { Some(fs::read_to_string(safe_file(&root, &change.path)?).map_err(|e| e.to_string())?) } else { None };
        if original.as_deref() != change.expected.as_deref() { return Err(format!("{} changed since inspection. Review the current version before saving.", change.path)); }
        validated.push((change.path, target, change.content, original));
    }
    // Validate the complete batch before writing any files. If one write fails,
    // restore already-touched files to their original bytes and report the failure.
    let mut written: Vec<(PathBuf, Option<String>)> = Vec::new();
    for (relative, target, content, original) in validated {
        let attempt = (|| -> Result<(), String> {
            if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
            if original.is_some() {
                let backup = target.with_extension(format!("{}.solarium.bak", target.extension().and_then(|e| e.to_str()).unwrap_or("txt")));
                fs::copy(&target, backup).map_err(|e| format!("Backup failed: {e}"))?;
            }
            let mut options = fs::OpenOptions::new();
            if original.is_some() { options.write(true).truncate(true); } else { options.write(true).create_new(true); }
            use std::io::Write;
            options.open(&target).map_err(|e| e.to_string())?.write_all(content.as_bytes()).map_err(|e| e.to_string())
        })();
        if let Err(error) = attempt {
            // Include current target; partial writes must not survive errors.
            if let Some(previous) = &original { let _ = fs::write(&target, previous); } else { let _ = fs::remove_file(&target); }
            for (path, prior) in written.into_iter().rev() { if let Some(bytes) = prior { let _ = fs::write(path, bytes); } else { let _ = fs::remove_file(path); } }
            return Err(format!("Could not apply {relative}: {error}. Previously written files were rolled back."));
        }
        written.push((target, original));
    }
    Ok(written.into_iter().map(|(path, original)| AppliedChange { path: path.strip_prefix(&base).unwrap_or(&path).to_string_lossy().replace('\\', "/"), operation: if original.is_some() { "updated".into() } else { "created".into() } }).collect())
}

#[derive(Serialize)]
pub struct WebResult { pub title: String, pub url: String, pub excerpt: String }
fn public_https(input: &str) -> Result<(reqwest::Url, Vec<IpAddr>), String> {
    let url = reqwest::Url::parse(input).map_err(|e| e.to_string())?;
    if url.scheme() != "https" || url.username() != "" || url.password().is_some() || url.port_or_known_default() != Some(443) {
        return Err("Only public HTTPS URLs on port 443 can be opened.".into());
    }
    let host = url.host_str().ok_or("URL has no hostname")?;
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") || host.ends_with(".local") || host.ends_with(".internal") { return Err("Local network hosts are blocked.".into()); }
    let addresses: Vec<IpAddr> = (host, 443).to_socket_addrs().map_err(|e| format!("Cannot resolve host: {e}"))?.map(|s| s.ip()).collect();
    if addresses.is_empty() || addresses.iter().any(|ip| match ip {
        IpAddr::V4(v) => v.is_private() || v.is_loopback() || v.is_link_local() || v.is_multicast() || v.is_unspecified() || v.octets() == [255, 255, 255, 255] || v.octets()[0] == 0 || v.octets()[0] >= 240 || (v.octets()[0] == 100 && (64..128).contains(&v.octets()[1])),
        IpAddr::V6(v) => v.is_loopback() || v.is_unspecified() || v.is_multicast() || v.is_unique_local() || v.is_unicast_link_local() || v.to_ipv4_mapped().is_some_and(|v| v.is_private() || v.is_loopback() || v.is_link_local()),
    }) { return Err("Website resolves to a non-public address.".into()); }
    Ok((url, addresses))
}
fn client_for(url: &reqwest::Url, ips: &[IpAddr]) -> Result<reqwest::blocking::Client, String> {
    let mut builder = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(18)).connect_timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none()).user_agent("Solarium/0.1 (+local research)");
    if let Some(host) = url.host_str() { for ip in ips { builder = builder.resolve(host, std::net::SocketAddr::new(*ip, 443)); } }
    builder.build().map_err(|e| e.to_string())
}
fn decode_entities(input: &str) -> String {
    input.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").replace("&nbsp;", " ")
}
fn element(fragment: &str, tag: &str) -> String {
    let open = format!("<{tag}>"); let close = format!("</{tag}>");
    fragment.split_once(&open).and_then(|(_, tail)| tail.split_once(&close).map(|(text, _)| decode_entities(text))).unwrap_or_default()
}
#[tauri::command]
fn search_web_inner(query: String) -> Result<Vec<WebResult>, String> {
    let q = query.trim();
    if q.is_empty() || q.len() > 300 { return Err("Search query must contain 1–300 characters.".into()); }
    let mut url = reqwest::Url::parse("https://www.bing.com/search").map_err(|e| e.to_string())?;
    url.query_pairs_mut().append_pair("format", "rss").append_pair("q", q);
    let (url, ips) = public_https(url.as_str())?;
    let mut response = client_for(&url, &ips)?.get(url).send().map_err(|e| format!("Search unavailable: {e}"))?.error_for_status().map_err(|e| e.to_string())?;
    let mut raw = Vec::new(); response.by_ref().take(250_000).read_to_end(&mut raw).map_err(|e| e.to_string())?;
    let feed = String::from_utf8_lossy(&raw);
    if !feed.contains("<rss") { return Err("Bing did not return a search feed.".into()); }
    let mut results = Vec::new();
    for item in feed.split("<item>").skip(1).take(12) {
        let link = element(item, "link");
        if public_https(&link).is_err() { continue; }
        results.push(WebResult { title: element(item, "title"), url: link, excerpt: element(item, "description") });
    }
    Ok(results)
}
#[tauri::command]
fn read_web_inner(url: String) -> Result<String, String> {
    let (_, title, body, _) = fetch_readable(&url, false)?;
    Ok(format!("{title}\n{body}"))
}

#[tauri::command]
pub async fn search_public_web(query: String, web_enabled: bool, provider: Option<SearchProviderConfig>) -> Result<Vec<WebResult>, String> {
    if !web_enabled { return Err("Web Search is OFF".into()); }
    tauri::async_runtime::spawn_blocking(move || match provider {
        Some(config) if config.kind == "searxng" => search_searxng(query, config.endpoint.ok_or("Configure a SearXNG HTTPS endpoint")?),
        Some(config) if config.kind == "duckduckgo" => search_duckduckgo(query),
        Some(config) if config.kind == "mwmbl" => search_mwmbl(query),
        _ => search_web_inner(query),
    })
        .await.map_err(|e| format!("Search worker failed: {e}"))?
}
#[tauri::command]
pub async fn read_public_webpage(url: String, web_enabled: bool) -> Result<String, String> {
    if !web_enabled { return Err("Web Search is OFF".into()); }
    tauri::async_runtime::spawn_blocking(move || read_web_inner(url))
        .await.map_err(|e| format!("Website worker failed: {e}"))?
}

/// Real stdout/stderr produced by an approved project check. An event is sent
/// only when bytes were actually received from the child process.
#[derive(Clone, Serialize)]
pub struct ProjectCheckStreamEvent { pub stream: String, pub chunk: String }

#[tauri::command]
pub async fn run_project_check_stream(
    root: String,
    check: String,
    on_event: tauri::ipc::Channel<ProjectCheckStreamEvent>,
) -> Result<ProjectCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Read;
        use std::process::{Command, Stdio};
        use std::sync::mpsc;
        use std::thread;
        use std::time::Instant;
        let base = safe_root(&root)?;
        // Explicit allowlist, identical to the non-streaming command.
        let (program, args): (&str, &[&str]) = match check.as_str() {
            "npm_check" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["run", "check"]),
            "npm_test" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["test"]),
            "npm_build" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["run", "build"]),
            "cargo_check" => ("cargo", &["check", "--manifest-path", if base.join("src-tauri/Cargo.toml").is_file() { "src-tauri/Cargo.toml" } else { "Cargo.toml" }]),
            "npm_install" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["install", "--ignore-scripts", "--no-audit", "--no-fund"]),
            "npm_install_offline" => (if cfg!(windows) { "npm.cmd" } else { "npm" }, &["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"]),
            "git_diff" => ("git", &["diff", "--stat"]),
            "git_status" => ("git", &["status", "--short"]),
            _ => return Err("Unsupported project check.".into()),
        };
        let mut command = Command::new(program);
        crate::project_commands::clean_environment(&mut command);
        let mut child = command.args(args).current_dir(base)
            .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
            .spawn().map_err(|e| format!("Could not run {program}: {e}"))?;
        let stdout = child.stdout.take().ok_or("Child stdout could not be captured")?;
        let stderr = child.stderr.take().ok_or("Child stderr could not be captured")?;
        let (sender, receiver) = mpsc::channel::<(String, String)>();
        let reader = |mut pipe: Box<dyn Read + Send>, label: &'static str, sender: mpsc::Sender<(String, String)>| {
            thread::spawn(move || {
                let mut buffer = [0u8; 4096];
                while let Ok(n) = pipe.read(&mut buffer) {
                    if n == 0 { break; }
                    if sender.send((label.into(), String::from_utf8_lossy(&buffer[..n]).into_owned())).is_err() { break; }
                }
            })
        };
        let out_thread = reader(Box::new(stdout), "stdout", sender.clone());
        let err_thread = reader(Box::new(stderr), "stderr", sender);
        let mut output = String::new();
        let mut errors = String::new();
        let started = Instant::now();
        let mut completed = None;
        let mut timed_out = false;
        // A bounded 180s process lifetime is a safety property of the native
        // execution tool, not an LLM token or reasoning allowance.
        loop {
            while let Ok((stream, chunk)) = receiver.try_recv() {
                let target = if stream == "stderr" { &mut errors } else { &mut output };
                if target.len() < 80_000 {
                    let keep = chunk.len().min(80_000 - target.len());
                    // Avoid truncating UTF-8 between codepoints.
                    let mut boundary = keep;
                    while !chunk.is_char_boundary(boundary) { boundary -= 1; }
                    target.push_str(&chunk[..boundary]);
                }
                let _ = on_event.send(ProjectCheckStreamEvent { stream, chunk });
            }
            if let Some(status) = child.try_wait().map_err(|e| format!("Cannot check process: {e}"))? {
                completed = status.code();
                break;
            }
            if started.elapsed() >= Duration::from_secs(180) {
                timed_out = true;
                let _ = child.kill();
                let _ = child.wait();
                break;
            }
            thread::sleep(Duration::from_millis(60));
        }
        let _ = out_thread.join();
        let _ = err_thread.join();
        while let Ok((stream, chunk)) = receiver.try_recv() {
            let target = if stream == "stderr" { &mut errors } else { &mut output };
            if target.len() < 80_000 {
                let keep = chunk.len().min(80_000 - target.len());
                let mut boundary = keep;
                while !chunk.is_char_boundary(boundary) { boundary -= 1; }
                target.push_str(&chunk[..boundary]);
            }
            let _ = on_event.send(ProjectCheckStreamEvent { stream, chunk });
        }
        Ok(ProjectCheckResult { command: format!("{} {}", program, args.join(" ")),
            exit_code: completed, stdout: output, stderr: errors, timed_out })
    }).await.map_err(|e| format!("Project check worker failed: {e}"))?
}

#[cfg(test)]
mod foundation_tests {
    use super::*;
    fn fixture(label:&str)->PathBuf {let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();let path=std::env::temp_dir().join(format!("solarium-{label}-{stamp}"));fs::create_dir_all(&path).unwrap();path}
    #[test]
    fn inspection_does_not_confuse_binary_only_directory_with_empty_project(){
        let dir=fixture("inspect");let root=dir.to_string_lossy().to_string();let empty=inspect_project_environment(root.clone()).unwrap();assert_eq!(empty.root_entry_count,0);assert_eq!(empty.file_count,0);
        fs::write(dir.join("clip.mp4"),b"media fixture").unwrap();let media=inspect_project_environment(root).unwrap();assert_eq!(media.file_count,0);assert_eq!(media.root_entry_count,1);let _=fs::remove_dir_all(dir);
    }
    #[test]
    fn reviewed_batch_creates_real_files_rejects_conflicts_and_traversal(){
        let dir=fixture("batch");let root=dir.to_string_lossy().to_string();let files=vec![ProjectFileChange{path:"package.json".into(),content:"{\"scripts\":{\"check\":\"tsc --noEmit\"}}".into(),expected:None},ProjectFileChange{path:"src/main.ts".into(),content:"export const version = '0.1';".into(),expected:None}];
        let changes=apply_project_changes(root.clone(),files).unwrap();assert_eq!(changes.len(),2);assert_eq!(changes[0].operation,"created");assert!(dir.join("src/main.ts").is_file());
        let conflict=vec![ProjectFileChange{path:"new.ts".into(),content:"new".into(),expected:None},ProjectFileChange{path:"src/main.ts".into(),content:"bad".into(),expected:None}];assert!(apply_project_changes(root.clone(),conflict).is_err());assert!(!dir.join("new.ts").exists());
        assert!(apply_project_changes(root,vec![ProjectFileChange{path:"../outside.ts".into(),content:"escape".into(),expected:None}]).is_err());let _=fs::remove_dir_all(dir);
    }
    #[test]
    fn network_guard_rejects_loopback_and_credential_urls_without_fetching(){
        assert!(public_https("https://127.0.0.1/secret").is_err());assert!(public_https("https://user:password@example.com/").is_err());assert!(public_https("file:///etc/passwd").is_err());
    }
    #[test]
    fn mwmbl_results_use_provider_urls_and_skip_invalid_entries() {
        let results = parse_mwmbl_results(br#"{"results":[
            {"url":"https://1.1.1.1/reference","title":"Reference","content":"A useful excerpt."},
            {"url":"http://1.1.1.1/unsecured","title":"Unsecured"},
            {"url":"https://127.0.0.1/private","title":"Private"},
            {"url":"https://1.1.1.1/no-title"}
        ]}"#).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].url, "https://1.1.1.1/reference");
        assert_eq!(results[0].excerpt, "A useful excerpt.");
        assert!(parse_mwmbl_results(br#"{"results":[]}"#).unwrap().is_empty());
        assert!(parse_mwmbl_results(br#"{"unexpected":[]}"#).is_err());
    }
    #[test]
    fn project_scripts_are_readable_and_editable_in_both_module_formats(){
        let dir=fixture("scripts");let root=dir.to_string_lossy().to_string();
        apply_project_changes(root.clone(),vec![ProjectFileChange{path:"scripts/check.cjs".into(),content:"console.log('checked');".into(),expected:None},ProjectFileChange{path:"scripts/build.mjs".into(),content:"export const ready = true;".into(),expected:None}]).unwrap();
        let paths=list_project_files(root.clone()).unwrap();assert!(paths.contains(&"scripts/check.cjs".into()));assert!(paths.contains(&"scripts/build.mjs".into()));assert_eq!(read_project_file(root,"scripts/check.cjs".into()).unwrap(),"console.log('checked');");let _=fs::remove_dir_all(dir);
    }
    #[test]
    fn generated_source_reviews_missing_parents_without_writes_then_applies_with_cas_and_backup(){
        let dir=fixture("generated-nested");let root=dir.to_string_lossy().to_string();let path="src/new/birds.js".to_string();
        assert!(!inspect_generated_file(root.clone(),path.clone()).unwrap().exists);
        assert!(!dir.join("src").exists(),"Review must not create project directories");
        save_generated_file(root.clone(),path.clone(),"export const birds='水🦜';".into(),None).unwrap();
        let current=inspect_generated_file(root.clone(),path.clone()).unwrap();assert!(current.exists);assert_eq!(current.current,"export const birds='水🦜';");
        assert!(save_generated_file(root.clone(),path.clone(),"stale".into(),None).is_err());
        save_generated_file(root.clone(),path.clone(),"export const birds=2;".into(),Some(current.current.clone())).unwrap();
        assert_eq!(fs::read_to_string(dir.join("src/new/birds.js.solarium.bak")).unwrap(),current.current);
        assert!(inspect_generated_file(root.clone(),"../outside.js".into()).is_err());
        fs::write(dir.join("parent-file"),"not a folder").unwrap();assert!(inspect_generated_file(root,"parent-file/bird.js".into()).is_err());
        let _=fs::remove_dir_all(dir);
    }
}
