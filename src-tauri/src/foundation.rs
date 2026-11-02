//! Durable Sources/Writing store. A single connection owns each atomic CAS transaction.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Connection, Row, SqliteConnection};
use tauri::Manager;

#[derive(Clone, Deserialize, Serialize)]
pub struct Scope { kind: String, id: String }
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Record { id: String, collection: String, scope: Scope, story_id: Option<String>, title: String, data: Value, version: i64, updated_at: String }
#[derive(Deserialize)]
pub struct Write { record: Record, expected: Option<i64>, body: Option<String> }
#[derive(Deserialize)]
pub struct Delete { id: String, expected: i64 }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Filter { collection: Option<String>, scopes: Vec<Scope>, story_id: Option<String>, query: Option<String> }
fn valid_scope(scope: &Scope) -> bool { matches!(scope.kind.as_str(), "chat" | "project" | "library") && !scope.id.is_empty() && scope.id.len() <= 180 && (scope.kind != "library" || scope.id == "personal") }
async fn database(app: &tauri::AppHandle) -> Result<SqliteConnection, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    open_database(&dir.join("foundation-v1.db")).await
}
async fn open_database(path: &std::path::Path) -> Result<SqliteConnection, String> {
    let options = sqlx::sqlite::SqliteConnectOptions::new().filename(path).create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal).busy_timeout(std::time::Duration::from_secs(15)).foreign_keys(true);
    let mut db = SqliteConnection::connect_with(&options).await.map_err(|e| e.to_string())?;
    let version: (i64,) = sqlx::query_as("PRAGMA user_version").fetch_one(&mut db).await.map_err(|e| e.to_string())?;
    if version.0 == 0 { for statement in [
        "CREATE TABLE IF NOT EXISTS foundation_records (id TEXT PRIMARY KEY, collection TEXT NOT NULL, scope_kind TEXT NOT NULL, scope_id TEXT NOT NULL, story_id TEXT, title TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS foundation_scope ON foundation_records(scope_kind,scope_id,collection,story_id)",
        "CREATE TABLE IF NOT EXISTS foundation_content (id TEXT PRIMARY KEY REFERENCES foundation_records(id) ON DELETE CASCADE, body TEXT NOT NULL)",
        "PRAGMA user_version=1"
    ] { sqlx::query(statement).execute(&mut db).await.map_err(|e| e.to_string())?; } }
    Ok(db)
}
#[tauri::command]
pub async fn foundation_list(app: tauri::AppHandle, filter: Filter) -> Result<Vec<Record>, String> {
    if filter.scopes.len() > 10 || filter.scopes.iter().any(|s| !valid_scope(s)) { return Err("Invalid retrieval scope".into()); }
    let mut db = database(&app).await?; let mut result = Vec::new();
    for scope in filter.scopes {
        let rows = sqlx::query("SELECT * FROM foundation_records WHERE scope_kind=? AND scope_id=? AND (? IS NULL OR collection=?) AND (? IS NULL OR story_id=?) AND (? IS NULL OR lower(title || ' ' || data) LIKE '%' || lower(?) || '%') ORDER BY updated_at DESC")
            .bind(&scope.kind).bind(&scope.id).bind(&filter.collection).bind(&filter.collection).bind(&filter.story_id).bind(&filter.story_id).bind(&filter.query).bind(&filter.query)
            .fetch_all(&mut db).await.map_err(|e| e.to_string())?;
        for row in rows {
            // A corrupt record remains on disk for recovery; healthy records still load.
            if let Ok(data) = serde_json::from_str(row.get::<&str,_>("data")) {
                result.push(Record { id: row.get("id"), collection: row.get("collection"), scope: scope.clone(), story_id: row.get("story_id"), title: row.get("title"), data, version: row.get("version"), updated_at: row.get("updated_at") });
            }
        }
    }
    Ok(result)
}
#[tauri::command]
pub async fn foundation_body(app: tauri::AppHandle, id: String, scopes: Vec<Scope>) -> Result<Option<String>, String> {
    if scopes.len() > 10 || scopes.iter().any(|s| !valid_scope(s)) { return Err("Invalid scope".into()); }
    let mut db = database(&app).await?;
    for s in scopes {
        if let Some(row) = sqlx::query("SELECT body FROM foundation_content JOIN foundation_records USING(id) WHERE id=? AND scope_kind=? AND scope_id=?")
            .bind(&id).bind(s.kind).bind(s.id).fetch_optional(&mut db).await.map_err(|e| e.to_string())? { return Ok(Some(row.get("body"))); }
    }
    Ok(None)
}
async fn apply(db: &mut SqliteConnection, puts: Vec<Write>, deletes: Vec<Delete>) -> Result<(), String> {
    if puts.len() + deletes.len() > 20_000 { return Err("Import has too many records".into()); }
    let mut seen = std::collections::HashSet::new();
    for p in &puts {
        let r = &p.record;
        if !seen.insert(r.id.clone()) || r.id.is_empty() || r.id.len() > 180 || !valid_scope(&r.scope) || r.version != p.expected.unwrap_or(0) + 1 || r.title.len() > 1000 || r.data.to_string().len() > 2_500_000 || p.body.as_ref().is_some_and(|b| b.len() > 8_000_000) { return Err("Invalid record or revision".into()); }
    }
    for d in &deletes { if !seen.insert(d.id.clone()) { return Err("Duplicate transaction target".into()); } }
    // Acquire the writer before reading CAS versions. A deferred WAL snapshot
    // cannot upgrade after a concurrent commit, even with busy_timeout set.
    let mut tx = db.begin_with("BEGIN IMMEDIATE").await.map_err(|e| e.to_string())?;
    for p in puts {
        let existing: Option<(i64,)> = sqlx::query_as("SELECT version FROM foundation_records WHERE id=?").bind(&p.record.id).fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;
        if existing.map(|r| r.0) != p.expected { return Err("Revision conflict: item changed; reload before saving".into()); }
        let r = p.record;
        sqlx::query("INSERT INTO foundation_records VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET scope_kind=excluded.scope_kind,scope_id=excluded.scope_id,story_id=excluded.story_id,title=excluded.title,data=excluded.data,version=excluded.version,updated_at=excluded.updated_at")
            .bind(&r.id).bind(r.collection).bind(r.scope.kind).bind(r.scope.id).bind(r.story_id).bind(r.title).bind(r.data.to_string()).bind(r.version).bind(r.updated_at).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        if let Some(body) = p.body { sqlx::query("INSERT INTO foundation_content VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind(r.id).bind(body).execute(&mut *tx).await.map_err(|e| e.to_string())?; }
    }
    for d in deletes {
        let deleted = sqlx::query("DELETE FROM foundation_records WHERE id=? AND version=?").bind(d.id).bind(d.expected).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        if deleted.rows_affected() != 1 { return Err("Revision conflict during delete".into()); }
    }
    tx.commit().await.map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn foundation_batch(app: tauri::AppHandle, puts: Vec<Write>, deletes: Vec<Delete>) -> Result<(), String> { apply(&mut database(&app).await?, puts, deletes).await }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sqlite_transaction_conflict_rolls_back_content_and_metadata() {
        tauri::async_runtime::block_on(async {
            let path = std::env::temp_dir().join(format!("solarium-foundation-{}.db", std::process::id()));
            let mut db = open_database(&path).await.unwrap();
            sqlx::query("DELETE FROM foundation_records").execute(&mut db).await.unwrap();
            let make = |id: &str, expected:Option<i64>| Write { record: Record { id: id.into(), collection: "source".into(), scope: Scope {kind:"chat".into(),id:"c".into()}, story_id:None, title:"Test".into(),data:serde_json::json!({}),version:expected.unwrap_or(0)+1,updated_at:"now".into() },expected,body:Some("persisted content".into()) };
            apply(&mut db, vec![make("a",None)],vec![]).await.unwrap();
            assert!(apply(&mut db,vec![make("b",None),make("a",None)],vec![]).await.is_err());
            let count: (i64,) = sqlx::query_as("SELECT count(*) FROM foundation_records").fetch_one(&mut db).await.unwrap(); assert_eq!(count.0,1);
            db.close().await.unwrap(); let _ = std::fs::remove_file(path);
        });
    }
    #[test]
    fn concurrent_native_saves_keep_all_records_and_enforce_cas() {
        tauri::async_runtime::block_on(async {
            let path = std::env::temp_dir().join(format!("solarium-concurrent-{}.db", std::process::id()));
            let mut left = open_database(&path).await.unwrap();
            sqlx::query("DELETE FROM foundation_records").execute(&mut left).await.unwrap();
            let mut right = open_database(&path).await.unwrap();
            let make = |prefix: &str| (0..32).map(|i| Write { record: Record {
                id: format!("{prefix}-{i}"), collection: "source".into(), scope: Scope {kind:"chat".into(),id:"c".into()},
                story_id:None, title:"Concurrent save".into(),data:serde_json::json!({}),version:1,updated_at:"now".into()
            }, expected:None, body:Some("actual persisted content".into()) }).collect();
            let a = make("left"); let b = make("right");
            let one = tauri::async_runtime::spawn(async move { let result = apply(&mut left,a,vec![]).await; (left,result) });
            let two = tauri::async_runtime::spawn(async move { let result = apply(&mut right,b,vec![]).await; (right,result) });
            let (mut left,first) = one.await.unwrap(); let (mut right,second) = two.await.unwrap();
            assert!(first.is_ok(), "{first:?}"); assert!(second.is_ok(), "{second:?}");
            let count:(i64,) = sqlx::query_as("SELECT count(*) FROM foundation_content").fetch_one(&mut left).await.unwrap(); assert_eq!(count.0,64);
            let a = make("same"); let b = make("same");
            let one = tauri::async_runtime::spawn(async move { let result = apply(&mut left,a,vec![]).await; (left,result) });
            let two = tauri::async_runtime::spawn(async move { let result = apply(&mut right,b,vec![]).await; (right,result) });
            let (mut left,first) = one.await.unwrap(); let (right,second) = two.await.unwrap();
            assert_ne!(first.is_ok(),second.is_ok());
            assert!(first.err().or(second.err()).unwrap().contains("Revision conflict"));
            let count:(i64,) = sqlx::query_as("SELECT count(*) FROM foundation_content").fetch_one(&mut left).await.unwrap(); assert_eq!(count.0,96);
            left.close().await.unwrap(); right.close().await.unwrap(); let _=std::fs::remove_file(path);
        });
    }

}
