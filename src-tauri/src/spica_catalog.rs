//! Local descriptor index. This module has no implementation resolver or execution API.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{Connection, QueryBuilder, Row, Sqlite, SqliteConnection};
use std::{collections::HashSet, time::Duration};
use tauri::Manager;

const VERSION: &str = "1.0.0";
const SCHEMA: &[&str] = &[
    "CREATE TABLE IF NOT EXISTS catalog_metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS catalog_entries (rowid INTEGER PRIMARY KEY, id TEXT NOT NULL, version TEXT NOT NULL, category INTEGER NOT NULL,
      kind TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, tags TEXT NOT NULL, reference TEXT NOT NULL, UNIQUE(id,version))",
    "CREATE INDEX IF NOT EXISTS catalog_category ON catalog_entries(category,kind,id)",
    "CREATE TABLE IF NOT EXISTS catalog_categories (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, capacity INTEGER NOT NULL, origin TEXT NOT NULL)",
    "CREATE VIRTUAL TABLE IF NOT EXISTS catalog_fts USING fts5(id,title,summary,tags, content='catalog_entries', prefix='2 3')",
];

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CatalogSeed {
    records: Vec<Draft>,
    intents: Vec<(String, String, String)>,
    domains: Vec<(String, String)>,
    policies: Vec<(String, String)>,
    #[serde(default)]
    categories: Vec<CategoryDefinition>,
    #[serde(default, rename = "manifestVersion")]
    manifest_version: Option<u8>,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Draft {
    id: String,
    category: u32,
    title: String,
    summary: String,
    tags: String,
    reference: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct CategoryDefinition {
    id: u32,
    slug: String,
    title: String,
    capacity: u32,
    origin: String,
}

#[derive(Serialize)]
pub struct CatalogCounts {
    revision: String,
    entries: i64,
    profiles: i64,
}

#[derive(Serialize)]
pub struct CatalogEntry {
    id: String,
    version: String,
    category: i64,
    kind: String,
    maturity: &'static str,
    title: String,
    summary: String,
    tags: String,
    reference: String,
}

#[derive(Serialize)]
pub struct CatalogPage {
    candidates: Vec<CatalogEntry>,
    total: i64,
}

fn category_slug(value: &str) -> bool {
    value.len() >= 2 && value.len() <= 60 &&
    value.bytes().next().is_some_and(|c| c.is_ascii_lowercase()) &&
    value.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
}

fn plain_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 60
        && value
            .bytes()
            .next()
            .is_some_and(|b| b.is_ascii_alphanumeric())
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
}

fn valid_id(value: &str) -> bool {
    value.len() <= 200
        && value
            .strip_prefix("spica.")
            .is_some_and(|rest| rest.split('.').all(plain_slug))
}

fn bounded(value: &str, limit: usize) -> bool {
    !value.trim().is_empty() && value.len() <= limit && !value.contains('\0')
}

fn validate_seed(seed: &CatalogSeed) -> Result<(), String> {
    if seed.records.len() > 5000
        || seed.intents.len() != 40
        || seed.domains.len() != 25
        || seed.policies.len() != 10
    {
        return Err("Invalid SPICA descriptor and profile dimensions.".into());
    }
    if seed.manifest_version.is_some_and(|v| v != 2) || seed.categories.len() > 2000 {
        return Err("Unknown warehouse manifest version or oversized category registry.".into());
    }
    let mut category_ids = HashSet::new();
    let mut category_slugs = HashSet::new();
    for category in &seed.categories {
        if category.id == 0 || category.id > 1_000_000 || !category_slug(&category.slug) ||
            !bounded(&category.title, 100) || category.capacity == 0 || category.capacity > 1_000_000 ||
            category.origin != "builtin" || !(1..=35).contains(&category.id) ||
            !category_ids.insert(category.id) || !category_slugs.insert(&category.slug) {
            return Err("Invalid or duplicate bundled category registry.".into());
        }
    }
    if !seed.categories.is_empty() && category_ids.len() != 35 {
        return Err("The 35 original category IDs must remain stable.".into());
    }
    let mut ids = HashSet::new();
    for item in &seed.records {
        if !valid_id(&item.id)
            || item.id.starts_with("spica.research.profile.")
            || !(1..=35).contains(&item.category)
            || !ids.insert(&item.id)
            || !bounded(&item.title, 220)
            || !bounded(&item.summary, 1600)
            || !bounded(&item.tags, 1600)
            || !bounded(&item.reference, 2000)
        {
            return Err(format!(
                "Invalid or duplicate catalog descriptor {}.",
                item.id.chars().take(200).collect::<String>()
            ));
        }
    }
    for taxonomy in [
        seed.intents
            .iter()
            .map(|(id, label, _)| (id, label))
            .collect::<Vec<_>>(),
        seed.domains.iter().map(|(id, label)| (id, label)).collect(),
        seed.policies
            .iter()
            .map(|(id, label)| (id, label))
            .collect(),
    ] {
        let mut slugs = HashSet::new();
        if taxonomy
            .iter()
            .any(|(slug, label)| !plain_slug(slug) || !bounded(label, 320) || !slugs.insert(*slug))
        {
            return Err("Duplicate or invalid research taxonomy value.".into());
        }
    }
    if seed
        .intents
        .iter()
        .any(|(_, _, reference)| reference.len() > 80 || !reference.split('.').all(plain_slug))
    {
        return Err("Invalid research follow-up family.".into());
    }
    Ok(())
}

async fn database(app: &tauri::AppHandle) -> Result<SqliteConnection, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let options = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(dir.join("spica-catalog-v1.db"))
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(20));
    SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| error.to_string())
}

async fn install_seed(
    db: &mut SqliteConnection,
    seed: CatalogSeed,
) -> Result<CatalogCounts, String> {
    validate_seed(&seed)?;
    let digest = Sha256::digest(serde_json::to_vec(&seed).map_err(|error| error.to_string())?);
    let revision = format!("catalog-1-{digest:x}");
    let mut tx = db
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(|error| error.to_string())?;
    for statement in SCHEMA {
        sqlx::query(statement)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
    }
    let existing: Option<String> =
        sqlx::query_scalar("SELECT revision FROM catalog_metadata WHERE id=1")
            .fetch_optional(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
    // Revisions replace only bundled drafts. User category entries are kept in the same
    // indexed FTS corpus across application and manifest updates.
    for category in &seed.categories {
        sqlx::query("INSERT INTO catalog_categories(id,slug,title,capacity,origin) VALUES(?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,capacity=excluded.capacity
            WHERE catalog_categories.origin='builtin'")
            .bind(i64::from(category.id)).bind(&category.slug).bind(&category.title).bind(i64::from(category.capacity))
            .bind(&category.origin).execute(&mut *tx).await.map_err(|error| error.to_string())?;
    }
    if existing.as_deref() != Some(revision.as_str()) {
        sqlx::query("DELETE FROM catalog_entries WHERE category <= 35")
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        let mut rows: Vec<(Draft, &str)> = seed
            .records
            .into_iter()
            .map(|item| (item, "primitive"))
            .collect();
        for (intent, objective, follow) in seed.intents {
            for (domain, scope) in &seed.domains {
                for (policy, behavior) in &seed.policies {
                    rows.push((
                        Draft {
                            id: format!("spica.research.profile.{intent}.{domain}.{policy}"),
                            category: 27,
                            title: format!(
                                "{} · {}",
                                intent.replace('-', " "),
                                domain.replace('-', " ")
                            ),
                            summary: format!("{objective}. {behavior}"),
                            tags: format!("{domain} {policy} {scope}"),
                            reference: format!("Candidate follow-up family · {follow}"),
                        },
                        "profile",
                    ));
                }
            }
        }
        for batch in rows.chunks(100) {
            let mut insert: QueryBuilder<'_, Sqlite> = QueryBuilder::new("INSERT INTO catalog_entries(id,version,category,kind,title,summary,tags,reference) ");
            insert.push_values(batch, |mut values, (item, kind)| {
                values
                    .push_bind(&item.id)
                    .push_bind(VERSION)
                    .push_bind(i64::from(item.category))
                    .push_bind(*kind)
                    .push_bind(&item.title)
                    .push_bind(&item.summary)
                    .push_bind(&item.tags)
                    .push_bind(&item.reference);
            });
            insert
                .build()
                .execute(&mut *tx)
                .await
                .map_err(|error| error.to_string())?;
        }
        sqlx::query("INSERT INTO catalog_fts(catalog_fts) VALUES('rebuild')")
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        sqlx::query("INSERT INTO catalog_metadata VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision")
            .bind(&revision).execute(&mut *tx).await.map_err(|error| error.to_string())?;
    }
    let (entries, profiles): (i64, i64) = sqlx::query_as(
        "SELECT count(*), count(*) FILTER(WHERE kind='profile') FROM catalog_entries",
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|error| error.to_string())?;
    tx.commit().await.map_err(|error| error.to_string())?;
    Ok(CatalogCounts {
        revision,
        entries,
        profiles,
    })
}

fn row_entry(row: sqlx::sqlite::SqliteRow) -> CatalogEntry {
    CatalogEntry {
        id: row.get("id"),
        version: row.get("version"),
        category: row.get("category"),
        kind: row.get("kind"),
        maturity: "draft",
        title: row.get("title"),
        summary: row.get("summary"),
        tags: row.get("tags"),
        reference: row.get("reference"),
    }
}

fn search_expression(query: &str) -> Result<Option<String>, String> {
    if query.chars().count() > 200 {
        return Err("Keep warehouse queries within 200 characters.".into());
    }
    if query.trim().is_empty() {
        return Ok(None);
    }
    let terms = query
        .split(|character: char| !character.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .take(16)
        .map(|word| format!("\"{word}\"*"))
        .collect::<Vec<_>>();
    if terms.is_empty() {
        return Err("Use a searchable letter or number.".into());
    }
    Ok(Some(terms.join(" AND ")))
}

async fn search(
    db: &mut SqliteConnection,
    query: &str,
    category: Option<u32>,
    kind: Option<&str>,
    offset: u32,
    limit: u32,
) -> Result<CatalogPage, String> {
    let query = query.trim();
    let exact = query.strip_suffix("@1.0.0").unwrap_or(query);
    let exact_id = valid_id(exact);
    let expression = if exact_id {
        Some(exact.to_owned())
    } else {
        search_expression(query)?
    };
    if category.is_some_and(|id| id == 0 || id > 1_000_000)
        || kind.is_some_and(|value| !matches!(value, "primitive" | "profile"))
        || offset > 350_000
    {
        return Err("Invalid warehouse page or facet.".into());
    }
    let (from, order) = if exact_id {
        ("FROM catalog_entries AS e WHERE e.id=?", "e.id")
    } else if expression.is_some() {
        ("FROM catalog_fts JOIN catalog_entries AS e ON e.rowid=catalog_fts.rowid WHERE catalog_fts MATCH ?", "bm25(catalog_fts,1.0,5.0,2.0,1.0), e.id")
    } else {
        ("FROM catalog_entries AS e WHERE ? IS NULL", "e.id")
    };
    let filter = format!("{from} AND (? IS NULL OR e.category=?) AND (? IS NULL OR e.kind=?)");
    let count_sql = format!("SELECT count(*) {filter}");
    let entries_sql = format!("SELECT e.* {filter} ORDER BY {order} LIMIT ? OFFSET ?");
    let mut tx = db.begin().await.map_err(|error| error.to_string())?;
    let total: i64 = sqlx::query_scalar(&count_sql)
        .bind(&expression)
        .bind(category.map(i64::from))
        .bind(category.map(i64::from))
        .bind(kind)
        .bind(kind)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    let candidates = sqlx::query(&entries_sql)
        .bind(&expression)
        .bind(category.map(i64::from))
        .bind(category.map(i64::from))
        .bind(kind)
        .bind(kind)
        .bind(limit.clamp(1, 12))
        .bind(offset)
        .fetch_all(&mut *tx)
        .await
        .map_err(|error| error.to_string())?
        .into_iter()
        .map(row_entry)
        .collect();
    tx.commit().await.map_err(|error| error.to_string())?;
    Ok(CatalogPage { candidates, total })
}

#[tauri::command]
pub async fn spica_catalog_prepare(
    app: tauri::AppHandle,
    seed: CatalogSeed,
) -> Result<CatalogCounts, String> {
    install_seed(&mut database(&app).await?, seed).await
}

#[tauri::command]
pub async fn spica_catalog_search(
    app: tauri::AppHandle,
    query: String,
    category: Option<u32>,
    offset: u32,
    limit: u32,
    kind: Option<String>,
) -> Result<CatalogPage, String> {
    search(
        &mut database(&app).await?,
        &query,
        category,
        kind.as_deref(),
        offset,
        limit,
    )
    .await
}

#[tauri::command]
pub async fn spica_catalog_inspect(
    app: tauri::AppHandle,
    id: String,
    version: String,
) -> Result<CatalogEntry, String> {
    if !valid_id(&id) || version != VERSION {
        return Err("Use the exact draft ID and version from catalog search.".into());
    }
    sqlx::query("SELECT * FROM catalog_entries WHERE id=? AND version=?")
        .bind(id)
        .bind(version)
        .fetch_optional(&mut database(&app).await?)
        .await
        .map_err(|error| error.to_string())?
        .map(row_entry)
        .ok_or_else(|| "Unknown catalog descriptor. Search for another candidate.".into())
}

/// Persist a user-defined metadata namespace. Never registers executable source code.
#[tauri::command]
pub async fn spica_catalog_register_category(
    app: tauri::AppHandle, slug: String, title: String, capacity: u32,
) -> Result<CategoryDefinition, String> {
    if !category_slug(&slug) || !bounded(&title, 100) || capacity == 0 || capacity > 1_000_000 {
        return Err("Invalid category slug, title or capacity.".into());
    }
    let mut db = database(&app).await?;
    let mut tx = db.begin_with("BEGIN IMMEDIATE").await.map_err(|error| error.to_string())?;
    for statement in SCHEMA { sqlx::query(statement).execute(&mut *tx).await.map_err(|e| e.to_string())?; }
    let registered = sqlx::query("SELECT id,title,capacity,origin FROM catalog_categories WHERE slug=?")
        .bind(&slug).fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;
    if let Some(row) = registered {
        if row.get::<String,_>("origin") != "user" || row.get::<String,_>("title") != title || row.get::<i64,_>("capacity") != i64::from(capacity) {
            return Err("Category exists with a different immutable contract.".into());
        }
        let result = CategoryDefinition { id: row.get::<i64,_>("id") as u32, slug, title, capacity, origin: "user".into() };
        tx.commit().await.map_err(|e| e.to_string())?;
        return Ok(result);
    }
    let id: u32 = sqlx::query_scalar::<_, i64>("SELECT COALESCE(MAX(id), 35)+1 FROM catalog_categories")
        .fetch_one(&mut *tx).await.map_err(|e| e.to_string())? as u32;
    if id <= 35 || id > 1_000_000 { return Err("Category registry exhausted.".into()); }
    sqlx::query("INSERT INTO catalog_categories(id,slug,title,capacity,origin) VALUES(?,?,?,?, 'user')")
        .bind(i64::from(id)).bind(&slug).bind(&title).bind(i64::from(capacity)).execute(&mut *tx).await.map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(CategoryDefinition { id, slug, title, capacity, origin: "user".into() })
}

#[tauri::command]
pub async fn spica_catalog_categories(app: tauri::AppHandle) -> Result<Vec<CategoryDefinition>, String> {
    let mut db = database(&app).await?;
    // The bundled seed is initialized by the TS client before this query.
    sqlx::query("SELECT id,slug,title,capacity,origin FROM catalog_categories ORDER BY id")
        .fetch_all(&mut db).await.map_err(|e| e.to_string())?.into_iter().map(|row| Ok(CategoryDefinition {
            id: row.get::<i64,_>("id") as u32, slug: row.get("slug"), title: row.get("title"), capacity: row.get::<i64,_>("capacity") as u32, origin: row.get("origin"),
        })).collect()
}

/// Bounded user-authored draft metadata. Namespaced and non-runnable, including after reload.
#[tauri::command]
pub async fn spica_catalog_add_drafts(app: tauri::AppHandle, category: u32, records: Vec<Draft>) -> Result<u32, String> {
    if records.is_empty() || records.len() > 1000 { return Err("Send between 1 and 1000 metadata records per batch.".into()); }
    let mut db = database(&app).await?;
    let mut tx = db.begin_with("BEGIN IMMEDIATE").await.map_err(|e| e.to_string())?;
    let row = sqlx::query("SELECT slug,origin,capacity FROM catalog_categories WHERE id=?")
        .bind(i64::from(category)).fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?
        .ok_or("Register the target user category first.")?;
    if row.get::<String,_>("origin") != "user" { return Err("Bundled categories are read-only.".into()); }
    let prefix = format!("spica.user.{}.", row.get::<String,_>("slug").replace('-', "_"));
    let mut ids = HashSet::new();
    for item in &records {
        if item.category != category || !item.id.starts_with(&prefix) || !valid_id(&item.id) ||
            !bounded(&item.title,220) || !bounded(&item.summary,1600) || !bounded(&item.tags,1600) ||
            !bounded(&item.reference,2000) || !ids.insert(&item.id) {
            return Err("User metadata must use unique IDs under the registered namespace.".into());
        }
    }
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM catalog_entries WHERE category=?")
        .bind(i64::from(category)).fetch_one(&mut *tx).await.map_err(|e| e.to_string())?;
    if before + records.len() as i64 > row.get::<i64,_>("capacity") {
        return Err("User category capacity reached.".into());
    }
    for item in &records {
        let result = sqlx::query("INSERT INTO catalog_entries(id,version,category,kind,title,summary,tags,reference)
            VALUES(?,? ,?,'primitive',?,?,?,?)")
            .bind(&item.id).bind(VERSION).bind(i64::from(item.category)).bind(&item.title).bind(&item.summary)
            .bind(&item.tags).bind(&item.reference).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        // Incremental FTS maintenance avoids quadratic full-index rebuilds per batch.
        sqlx::query("INSERT INTO catalog_fts(rowid,id,title,summary,tags) VALUES(?,?,?,?,?)")
            .bind(result.last_insert_rowid()).bind(&item.id).bind(&item.title).bind(&item.summary)
            .bind(&item.tags).execute(&mut *tx).await.map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(ids.len() as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> CatalogSeed {
        CatalogSeed {
            categories: vec![], manifest_version: None,
            records: vec![Draft {
                id: "spica.atlas.token".into(),
                category: 29,
                title: "Token alias".into(),
                summary: "Style token".into(),
                tags: "theme".into(),
                reference: "Design proposal".into(),
            }],
            intents: (0..40)
                .map(|n| {
                    (
                        format!("intent-{n}"),
                        "Find official setup".into(),
                        "docs.inspect".into(),
                    )
                })
                .collect(),
            domains: (0..25)
                .map(|n| (format!("domain-{n}"), "Local tools".into()))
                .collect(),
            policies: (0..10)
                .map(|n| (format!("policy-{n}"), "Evidence requirement".into()))
                .collect(),
        }
    }

    #[test]
    fn draft_index_validates_product_and_preserves_good_revision() {
        tauri::async_runtime::block_on(async {
            let mut db = SqliteConnection::connect("sqlite::memory:").await.unwrap();
            let counts = install_seed(&mut db, fixture()).await.unwrap();
            assert_eq!((counts.entries, counts.profiles), (10_001, 10_000));
            let result = search(&mut db, "offic set", Some(27), Some("profile"), 0, 40)
                .await
                .unwrap();
            assert_eq!(result.candidates.len(), 12);
            assert_eq!(result.total, 10_000);
            assert!(result
                .candidates
                .iter()
                .all(|item| item.maturity == "draft"));
            let exact = search(
                &mut db,
                "spica.research.profile.intent-9.domain-24.policy-9@1.0.0",
                Some(27),
                Some("profile"),
                0,
                8,
            )
            .await
            .unwrap();
            assert_eq!(exact.total, 1);
            assert_eq!(
                exact.candidates[0].id,
                "spica.research.profile.intent-9.domain-24.policy-9"
            );
            let mut invalid = fixture();
            invalid.policies[1].0 = invalid.policies[0].0.clone();
            assert!(install_seed(&mut db, invalid).await.is_err());
            assert_eq!(
                search(&mut db, "", Some(29), None, 0, 8)
                    .await
                    .unwrap()
                    .total,
                1
            );
            assert_eq!(
                search(&mut db, "\" OR *", None, None, 0, 8)
                    .await
                    .unwrap()
                    .total,
                0
            );
            assert_eq!(
                install_seed(&mut db, fixture()).await.unwrap().revision,
                counts.revision
            );
        });
    }

    #[test]
    fn capacity_fixture_returns_bounded_pages() {
        tauri::async_runtime::block_on(async {
            let mut db = SqliteConnection::connect("sqlite::memory:").await.unwrap();
            for statement in SCHEMA {
                sqlx::query(statement).execute(&mut db).await.unwrap();
            }
            let started = std::time::Instant::now();
            sqlx::query("WITH RECURSIVE slots(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM slots WHERE n<349999)
              INSERT INTO catalog_entries(id,version,category,kind,title,summary,tags,reference)
              SELECT 'spica.fixture.'||n,'1.0.0',n/10000+1,'primitive','Fixture slot','Search scale sample','sample','Synthetic test' FROM slots")
                .execute(&mut db).await.unwrap();
            sqlx::query("INSERT INTO catalog_fts(catalog_fts) VALUES('rebuild')")
                .execute(&mut db)
                .await
                .unwrap();
            let indexed = started.elapsed();
            let start = std::time::Instant::now();
            let page = search(&mut db, "scale", Some(35), Some("primitive"), 9988, 12)
                .await
                .unwrap();
            assert_eq!(page.total, 10_000);
            assert_eq!(page.candidates.len(), 12);
            eprintln!(
                "350,000 synthetic records indexed in {indexed:?}; filtered page returned in {:?}",
                start.elapsed()
            );
        });
    }
}
