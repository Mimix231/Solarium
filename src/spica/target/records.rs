use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{Sqlite, SqlitePool, Transaction};
use std::collections::BTreeMap;
use tauri::State;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Field {
    Boolean { initial: bool },
    Text { initial: String, #[serde(default)] required: bool },
    Reference { initial: Option<i64>, collection: String },
}

impl Field {
    fn default_value(&self) -> Value {
        match self {
            Self::Boolean { initial } => Value::Bool(*initial),
            Self::Text { initial, .. } => Value::String(initial.clone()),
            Self::Reference { initial, .. } => initial.map_or(Value::Null, Value::from),
        }
    }

    fn accepts(&self, value: &Value) -> bool {
        match self {
            Self::Boolean { .. } => value.is_boolean(),
            Self::Text { required, .. } => value.as_str().is_some_and(|text|
                text.encode_utf16().count() <= 16000 && (!required || !text.trim().is_empty())
            ),
            Self::Reference { .. } => value.is_null() || value.as_i64().is_some_and(|id| id > 0 && id <= 9_007_199_254_740_991),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct Schema {
    id: String,
    fields: BTreeMap<String, Field>,
}

fn read_schema(collection: &Value) -> Schema {
    Schema {
        id: collection["id"].as_str().expect("compiled collection ID").to_owned(),
        fields: collection["fields"].as_array().expect("compiled fields").iter().map(|field| (
            field["key"].as_str().expect("compiled field key").to_owned(),
            serde_json::from_value(field.clone()).expect("compiled field type"),
        )).collect(),
    }
}

type StoreResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

#[derive(Clone, Copy)]
struct Scope<'a> { schema: &'a Schema, primary: bool }

impl<'a> Scope<'a> {
    fn key(self) -> Option<&'a str> { (!self.primary).then_some(self.schema.id.as_str()) }
    fn table(self) -> &'static str { if self.primary { "spica_records" } else { "spica_related_records" } }
    fn predicate(self) -> &'static str { if self.primary { "? IS NULL" } else { "collection=?" } }
}

async fn stored_schema(tx: &mut Transaction<'_, Sqlite>, scope: Scope<'_>) -> StoreResult<Option<Schema>> {
    let body: Option<String> = if scope.primary {
        sqlx::query_scalar("SELECT body FROM spica_collection WHERE id=1").fetch_optional(&mut **tx).await?
    } else {
        sqlx::query_scalar("SELECT body FROM spica_related_collections WHERE id=?").bind(&scope.schema.id).fetch_optional(&mut **tx).await?
    };
    Ok(body.map(|body| serde_json::from_str(&body)).transpose()?)
}

async fn migrate_all(db: &SqlitePool, schemas: &[Schema]) -> StoreResult<()> {
    let mut tx = db.begin_with("BEGIN IMMEDIATE").await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS spica_collection (
        id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL CHECK(json_valid(body))
    )").execute(&mut *tx).await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS spica_records (
        id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
        body TEXT NOT NULL CHECK(json_valid(body)), modified INTEGER NOT NULL DEFAULT (unixepoch())
    )").execute(&mut *tx).await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS spica_related_collections (
        id TEXT PRIMARY KEY, body TEXT NOT NULL CHECK(json_valid(body))
    )").execute(&mut *tx).await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS spica_related_records (
        id INTEGER PRIMARY KEY, collection TEXT NOT NULL REFERENCES spica_related_collections(id),
        revision INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
        body TEXT NOT NULL CHECK(json_valid(body)), modified INTEGER NOT NULL DEFAULT (unixepoch())
    )").execute(&mut *tx).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS spica_related_listing ON spica_related_records(collection, archived, modified DESC, id DESC)")
        .execute(&mut *tx).await?;
    for (index, schema) in schemas.iter().enumerate() {
        migrate_scope(&mut tx, Scope { schema, primary: index == 0 }).await?;
    }
    tx.commit().await?;
    Ok(())
}

async fn migrate_scope(tx: &mut Transaction<'_, Sqlite>, scope: Scope<'_>) -> StoreResult<()> {
    let schema = scope.schema;
    if let Some(previous) = stored_schema(tx, scope).await? {
        if &previous == schema {
            return Ok(());
        }
        if previous.id != schema.id || previous.fields.iter().any(|(key, field)| schema.fields.get(key) != Some(field)) {
            return Err("The new app changes or removes an existing storage field. Reopen with a compatible build.".into());
        }
        for (key, field) in schema.fields.iter().filter(|(key, _)| !previous.fields.contains_key(*key)) {
            let value = field.default_value();
            if !field.accepts(&value) {
                return Err(format!("The new field {key} has no valid backfill value.").into());
            }
            let sql = format!("UPDATE {} SET body=json_set(body, ?, json(?)), revision=revision+1 WHERE {}", scope.table(), scope.predicate());
            sqlx::query(&sql).bind(format!("$.{key}")).bind(value.to_string()).bind(scope.key()).execute(&mut **tx).await?;
        }
    }
    let body = serde_json::to_string(schema)?;
    if scope.primary {
        sqlx::query("INSERT INTO spica_collection VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body")
            .bind(body).execute(&mut **tx).await?;
    } else {
        sqlx::query("INSERT INTO spica_related_collections VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body")
            .bind(&schema.id).bind(body).execute(&mut **tx).await?;
    }
    Ok(())
}

pub struct CollectionState { schemas: Result<Vec<Schema>, String>, write_enabled: bool, import_enabled: bool }

impl CollectionState {
    pub async fn open(db: &SqlitePool) -> Self {
        let plan = super::plan();
        let mut schemas: Vec<_> = plan.get("collection").map(read_schema).into_iter().collect();
        if let Some(related) = plan["collections"].as_array() { schemas.extend(related.iter().map(read_schema)); }
        let grants = plan["program"]["grants"].as_array();
        let write_enabled = grants.is_none_or(|grants| grants.contains(&Value::from("records.write")));
        let import_enabled = grants.is_some_and(|grants| grants.contains(&Value::from("files.open")));
        let result = if schemas.is_empty() { Ok(()) } else { migrate_all(db, &schemas).await };
        Self { schemas: result.map(|()| schemas).map_err(|error| format!("Collection upgrade failed. Saved records were kept. {error}")),
            write_enabled, import_enabled }
    }

    fn scopes(&self) -> Result<&[Schema], String> {
        self.schemas.as_deref().map_err(Clone::clone)
    }
}

fn select_scope<'a>(schemas: &'a [Schema], key: Option<&str>) -> StoreResult<Scope<'a>> {
    let index = if let Some(key) = key {
        schemas.iter().position(|schema| schema.id == key).ok_or("Unknown record collection.")?
    } else { 0 };
    let schema = schemas.get(index).ok_or("This app has no collection.")?;
    Ok(Scope { schema, primary: index == 0 })
}

async fn assert_schema(tx: &mut Transaction<'_, Sqlite>, scope: Scope<'_>) -> StoreResult<()> {
    if stored_schema(tx, scope).await?.as_ref() != Some(scope.schema) {
        return Err("Another version changed this collection. Reopen the latest app.".into());
    }
    Ok(())
}

#[derive(Serialize)]
pub struct Record {
    id: i64,
    revision: i64,
    archived: bool,
    values: Map<String, Value>,
}

#[derive(Serialize)]
pub struct Page {
    rows: Vec<Record>,
    more: bool,
}

#[derive(Deserialize)]
pub struct RecordQuery {
    query: String,
    archived: bool,
    filter: Option<String>,
    offset: i64,
    collection: Option<String>,
}

#[tauri::command]
pub async fn read_records(db: State<'_, SqlitePool>, collection: State<'_, CollectionState>, query: RecordQuery) -> Result<Page, String> {
    read_scoped(&db, collection.scopes()?, query).await.map_err(|error| error.to_string())
}

async fn read_scoped(db: &SqlitePool, schemas: &[Schema], query: RecordQuery) -> StoreResult<Page> {
    let scope = select_scope(schemas, query.collection.as_deref())?;
    if query.query.len() > 1024 || query.offset < 0 || query.filter.as_ref().is_some_and(|key| !matches!(scope.schema.fields.get(key), Some(Field::Boolean { .. }))) {
        return Err("Invalid collection query.".into());
    }
    let mut tx = db.begin().await?;
    assert_schema(&mut tx, scope).await?;
    let text = query.query.trim();
    let sql = format!("SELECT id,revision,archived,body FROM {} WHERE {} AND archived=?
        AND (? IS NULL OR EXISTS(SELECT 1 FROM json_each(body) WHERE key=? AND type='true'))
        AND (?='' OR EXISTS(SELECT 1 FROM json_each(body) WHERE type='text' AND instr(lower(value),lower(?))>0))
        ORDER BY modified DESC, id DESC LIMIT 51 OFFSET ?", scope.table(), scope.predicate());
    let rows: Vec<(i64, i64, bool, String)> = sqlx::query_as(&sql)
        .bind(scope.key()).bind(query.archived).bind(&query.filter).bind(&query.filter).bind(text).bind(text).bind(query.offset)
        .fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let more = rows.len() > 50;
    let rows = rows.into_iter().take(50).map(|(id, revision, archived, body)| Ok(Record {
        id, revision, archived, values: serde_json::from_str(&body)?,
    })).collect::<StoreResult<_>>()?;
    Ok(Page { rows, more })
}

#[derive(Deserialize)]
pub struct RecordWrite {
    id: Option<i64>,
    expected: Option<i64>,
    archived: bool,
    values: Map<String, Value>,
    collection: Option<String>,
}

#[tauri::command]
pub async fn save_record(db: State<'_, SqlitePool>, collection: State<'_, CollectionState>, record: RecordWrite) -> Result<Record, String> {
    if !collection.write_enabled { return Err("Capability denied · records.write".into()); }
    write_scoped(&db, collection.scopes()?, record).await.map_err(|error| error.to_string())
}

async fn write_scoped(db: &SqlitePool, schemas: &[Schema], record: RecordWrite) -> StoreResult<Record> {
    let mut tx = db.begin_with("BEGIN IMMEDIATE").await?;
    let saved = write_record(&mut tx, schemas, record).await?;
    tx.commit().await?;
    Ok(saved)
}

async fn write_record(tx: &mut Transaction<'_, Sqlite>, schemas: &[Schema], record: RecordWrite) -> StoreResult<Record> {
    let scope = select_scope(schemas, record.collection.as_deref())?;
    let schema = scope.schema;
    assert_schema(tx, scope).await?;
    if record.values.len() != schema.fields.len() {
        return Err("Supply every current record field.".into());
    }
    for (key, field) in &schema.fields {
        if !record.values.get(key).is_some_and(|value| field.accepts(value)) {
            return Err(format!("Invalid value for {key}.").into());
        }
        if let (Field::Reference { collection, .. }, Some(id)) = (field, record.values.get(key).and_then(Value::as_i64)) {
            let target = select_scope(schemas, Some(collection))?;
            let sql = format!("SELECT EXISTS(SELECT 1 FROM {} WHERE {} AND id=?)", target.table(), target.predicate());
            let exists: bool = sqlx::query_scalar(&sql).bind(target.key()).bind(id).fetch_one(&mut **tx).await?;
            if !exists { return Err(format!("The {key} record does not exist.").into()); }
        }
    }
    let body = serde_json::to_string(&record.values)?;
    let (id, revision) = match (record.id, record.expected) {
        (None, None) if !record.archived && !scope.primary => {
            sqlx::query_as("INSERT INTO spica_related_records(collection,revision,body) VALUES(?,1,?) RETURNING id,revision")
                .bind(scope.key()).bind(body).fetch_one(&mut **tx).await?
        }
        (None, None) if !record.archived => {
            sqlx::query_as("INSERT INTO spica_records(revision,body) VALUES(1,?) RETURNING id,revision")
                .bind(body).fetch_one(&mut **tx).await?
        }
        (Some(id), Some(expected)) if id > 0 && expected > 0 => {
            let sql = format!("UPDATE {} SET revision=revision+1, archived=?, body=?, modified=unixepoch()
                WHERE {} AND id=? AND revision=? RETURNING id,revision", scope.table(), scope.predicate());
            let result = sqlx::query_as(&sql).bind(record.archived).bind(body).bind(scope.key()).bind(id).bind(expected).fetch_optional(&mut **tx).await?;
            result.ok_or("This record changed elsewhere. Reload before saving.")?
        }
        _ => return Err("Invalid record revision.".into()),
    };
    Ok(Record { id, revision, archived: record.archived, values: record.values })
}

#[tauri::command]
pub async fn import_records(db: State<'_, SqlitePool>, state: State<'_, CollectionState>, collection: String,
    rows: Vec<Map<String, Value>>) -> Result<usize, String> {
    if !state.write_enabled || !state.import_enabled { return Err("Record import requires file and record write grants.".into()); }
    import_scoped(&db, state.scopes()?, &collection, rows).await.map_err(|error| error.to_string())
}

async fn import_scoped(db: &SqlitePool, schemas: &[Schema], collection: &str, rows: Vec<Map<String, Value>>) -> StoreResult<usize> {
    if rows.is_empty() || rows.len() > 1000 { return Err("Import 1 to 1,000 records per transaction.".into()); }
    let mut tx = db.begin_with("BEGIN IMMEDIATE").await?;
    let count = rows.len();
    for values in rows {
        write_record(&mut tx, schemas, RecordWrite { id: None, expected: None, archived: false,
            collection: Some(collection.into()), values }).await?;
    }
    tx.commit().await?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    async fn migrate(db: &SqlitePool, schema: &Schema) -> StoreResult<()> { migrate_all(db, std::slice::from_ref(schema)).await }
    async fn list(db: &SqlitePool, schema: &Schema, query: RecordQuery) -> StoreResult<Page> { read_scoped(db, std::slice::from_ref(schema), query).await }
    async fn write(db: &SqlitePool, schema: &Schema, record: RecordWrite) -> StoreResult<Record> { write_scoped(db, std::slice::from_ref(schema), record).await }

    fn schema() -> Schema {
        Schema { id: "notes".into(), fields: BTreeMap::from([
            ("title".into(), Field::Text { initial: String::new(), required: true }),
            ("body".into(), Field::Text { initial: String::new(), required: false }),
        ]) }
    }

    fn record(title: &str) -> RecordWrite {
        RecordWrite { id: None, expected: None, archived: false, collection: None,
            values: serde_json::from_value(json!({"title": title, "body":"Unicode 水"})).unwrap() }
    }

    fn query(filter: Option<&str>, archived: bool) -> RecordQuery {
        RecordQuery { query: "水".into(), archived, filter: filter.map(str::to_owned), offset: 0, collection: None }
    }

    #[test]
    fn collection_migration_preserves_rows_and_rolls_back_all_fields_on_failure() {
        tauri::async_runtime::block_on(async {
            let db = sqlx::sqlite::SqlitePoolOptions::new().max_connections(1)
                .connect("sqlite::memory:").await.unwrap();
            let original = schema();
            migrate(&db, &original).await.unwrap();
            let first = write(&db, &original, record("First")).await.unwrap();
            let second = write(&db, &original, record("Second")).await.unwrap();
            assert!(write(&db, &original, record(" ")).await.is_err());

            let mut next = original.clone();
            next.fields.insert("pinned".into(), Field::Boolean { initial: false });
            next.fields.insert("will_fail".into(), Field::Boolean { initial: true });
            sqlx::query("CREATE TRIGGER reject_test_migration BEFORE UPDATE ON spica_records
                WHEN json_type(NEW.body,'$.will_fail') IS NOT NULL
                BEGIN SELECT RAISE(ABORT,'injected migration failure'); END")
                .execute(&db).await.unwrap();
            assert!(migrate(&db, &next).await.unwrap_err().to_string().contains("injected migration failure"));
            let intact = list(&db, &original, query(None, false)).await.unwrap();
            assert_eq!(intact.rows.len(), 2);
            assert!(intact.rows.iter().all(|row| row.revision == 1 && !row.values.contains_key("pinned")));

            sqlx::query("DROP TRIGGER reject_test_migration").execute(&db).await.unwrap();
            next.fields.remove("will_fail");
            migrate(&db, &next).await.unwrap();
            migrate(&db, &next).await.unwrap();
            assert!(migrate(&db, &original).await.is_err());
            assert!(list(&db, &original, query(None, false)).await.is_err());
            let mut rows = list(&db, &next, query(None, false)).await.unwrap().rows;
            assert_eq!(rows.len(), 2);
            assert!(rows.iter().all(|row| row.values["pinned"] == false));
            assert!(rows.iter().any(|row| row.id == first.id && row.values["title"] == "First"));
            let row = rows.iter_mut().find(|row| row.id == second.id).unwrap();
            row.values.insert("pinned".into(), Value::Bool(true));
            let stale = RecordWrite { id: Some(row.id), expected: Some(1), archived: false, values: row.values.clone(), collection: None };
            assert!(write(&db, &next, stale).await.is_err());
            let pinned = write(&db, &next, RecordWrite { id: Some(row.id), expected: Some(row.revision), archived: false, values: row.values.clone(), collection: None }).await.unwrap();
            assert_eq!(list(&db, &next, query(Some("pinned"), false)).await.unwrap().rows[0].id, pinned.id);
            write(&db, &next, RecordWrite { id: Some(pinned.id), expected: Some(pinned.revision), archived: true, values: pinned.values, collection: None }).await.unwrap();
            assert!(list(&db, &next, query(Some("pinned"), false)).await.unwrap().rows.is_empty());
            assert_eq!(list(&db, &next, query(Some("pinned"), true)).await.unwrap().rows.len(), 1);
        });
    }
}
