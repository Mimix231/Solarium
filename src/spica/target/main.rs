#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use serde_json::{Map, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
use tauri::{Manager, State};

#[derive(Serialize)]
struct SavedPreferences {
    revision: i64,
    values: Map<String, Value>,
}

fn plan() -> Value {
    serde_json::from_str(include_str!("../../src/plan.json")).expect("compiled SPICA plan")
}

fn normalize(input: Map<String, Value>, strict: bool) -> Result<Map<String, Value>, String> {
    let mut values = Map::new();
    for page in plan()["pages"].as_array().expect("compiled pages") {
        for control in page["controls"].as_array().expect("compiled controls") {
            let definition = &control["definition"];
            let key = definition["key"].as_str().expect("compiled key");
            let value = input.get(key).unwrap_or(&definition["initial"]);
            let valid = match definition["type"].as_str() {
                Some("boolean") => value.is_boolean(),
                Some("text") => value.as_str().is_some_and(|text| text.encode_utf16().count() <= 16000),
                Some("choice") => definition["choices"].as_array().is_some_and(|choices| choices.contains(value)),
                _ => false,
            };
            if !valid { return Err(format!("Invalid preference: {key}")); }
            values.insert(key.to_owned(), value.clone());
        }
    }
    if strict && input.keys().any(|key| !values.contains_key(key)) {
        return Err("Unknown preference in imported values".into());
    }
    Ok(values)
}

async fn open_store(path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let db = SqlitePoolOptions::new().max_connections(1).connect_with(
        SqliteConnectOptions::new().filename(path).create_if_missing(true),
    ).await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, body TEXT NOT NULL
    )").execute(&db).await?;
    sqlx::query("INSERT OR IGNORE INTO preferences VALUES (1, 0, '{}')").execute(&db).await?;
    Ok(db)
}

async fn load(db: &SqlitePool) -> Result<SavedPreferences, String> {
    let (revision, body): (i64, String) = sqlx::query_as("SELECT revision, body FROM preferences WHERE id = 1")
        .fetch_one(db).await.map_err(|error| error.to_string())?;
    let input = serde_json::from_str(&body).map_err(|error| error.to_string())?;
    Ok(SavedPreferences { revision, values: normalize(input, false)? })
}

async fn save(db: &SqlitePool, expected: i64, input: Map<String, Value>) -> Result<i64, String> {
    let values = normalize(input, true)?;
    let body = serde_json::to_string(&values).map_err(|error| error.to_string())?;
    let result = sqlx::query("UPDATE preferences SET revision = revision + 1, body = ? WHERE id = 1 AND revision = ?")
        .bind(body).bind(expected).execute(db).await.map_err(|error| error.to_string())?;
    if result.rows_affected() != 1 { return Err("Preferences changed elsewhere. Reopen the app before saving.".into()); }
    Ok(expected + 1)
}

#[tauri::command]
async fn load_preferences(db: State<'_, SqlitePool>) -> Result<SavedPreferences, String> {
    load(&db).await
}

#[tauri::command]
async fn save_preferences(db: State<'_, SqlitePool>, expected: i64, values: Map<String, Value>) -> Result<i64, String> {
    save(&db, expected, values).await
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let mode = native_support::TestMode::from_args()?;
            let dir = match mode.fixture() {
                Some(fixture) => {
                    if let Some(window) = app.get_webview_window("main") { window.hide()?; }
                    fixture.clone()
                }
                None => app.path().app_data_dir()?,
            };
            std::fs::create_dir_all(&dir)?;
            let db = tauri::async_runtime::block_on(open_store(&dir.join("preferences.db")))?;
            app.manage(tauri::async_runtime::block_on(records::CollectionState::open(&db)));
            app.manage(mode);
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_preferences, save_preferences, records::read_records, records::save_record,
            records::import_records, native_support::spica_test_case, native_support::finish_spica_test, native_support::save_record_export])
        .run(tauri::generate_context!())
        .expect("run standalone SPICA app");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saved_values_survive_reopen_and_invalid_import_preserves_them() {
        let path = std::env::temp_dir().join(format!("spica-preferences-{}-{}.db", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        tauri::async_runtime::block_on(async {
            let db = open_store(&path).await.unwrap();
            let initial = load(&db).await.unwrap();
            let mut changed = initial.values;
            let definition = plan()["pages"].as_array().unwrap().iter()
                .flat_map(|page| page["controls"].as_array().unwrap())
                .map(|control| control["definition"].clone())
                .find(|definition| definition["type"] == "boolean").unwrap_or(Value::Null);
            if let Some(key) = definition["key"].as_str() {
                changed.insert(key.into(), Value::Bool(!definition["initial"].as_bool().unwrap()));
            }
            assert_eq!(save(&db, 0, changed.clone()).await.unwrap(), 1);
            assert!(save(&db, 0, changed.clone()).await.is_err());
            let mut invalid = changed.clone();
            invalid.insert("unknown_import_key".into(), Value::Null);
            assert!(save(&db, 1, invalid).await.is_err());
            db.close().await;
            let reopened = open_store(&path).await.unwrap();
            let saved = load(&reopened).await.unwrap();
            assert_eq!(saved.revision, 1);
            assert_eq!(saved.values, changed);
            reopened.close().await;
        });
        // File cleanup is separate from the persistence assertions. On Windows a
        // background SQLite or scanner handle can outlive the closed pool.
        if let Err(error) = std::fs::remove_file(&path) {
            eprintln!("Retained test database {}: {error}", path.display());
        }
    }
}
