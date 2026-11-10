//! DB plumbing — a single shared rusqlite connection behind a Mutex.
//!
//! SQLite is single-writer (journal_mode=WAL helps readers, not writers), so
//! a pool buys nothing; one `Mutex<Connection>` matches the concurrency model
//! honestly (spec item 306: single-writer SQLite WAL). All handler access is
//! marshalled through `Db::run` → `tokio::task::spawn_blocking` so the async
//! executor is never blocked.

use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use chrono::{SecondsFormat, Utc};
use rusqlite::Connection;

use crate::error::ApiError;

/// Current timestamp as ISO-8601 UTC ("2026-11-10T14:51:25.123Z") — the same
/// shape the web DTOs emit via Date::toISOString().
pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[derive(Clone)]
pub struct Db(Arc<Mutex<Connection>>);

impl Db {
    /// Open (creating if needed) the SQLite file and run pending migrations.
    /// Pass ":memory:" for an ephemeral test database.
    pub fn open(path: impl AsRef<Path>) -> Result<Self, ApiError> {
        let conn = Connection::open(path.as_ref())?;
        Self::init(conn)
    }

    pub fn open_in_memory() -> Result<Self, ApiError> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> Result<Self, ApiError> {
        conn.pragma_update(None, "foreign_keys", "ON")?;
        // WAL is unsupported on :memory: databases — ignore that failure only.
        let _ = conn.pragma_update(None, "journal_mode", "WAL");
        conn.pragma_update(None, "busy_timeout", 5000)?;
        let db = Self(Arc::new(Mutex::new(conn)));
        db.migrate()?;
        Ok(db)
    }

    /// Run `f` with exclusive connection access on a blocking thread.
    pub async fn run<T, F>(&self, f: F) -> Result<T, ApiError>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> Result<T, ApiError> + Send + 'static,
    {
        let conn = Arc::clone(&self.0);
        tokio::task::spawn_blocking(move || {
            let mut guard = conn
                .lock()
                .map_err(|_| ApiError::internal("database lock poisoned"))?;
            f(&mut guard)
        })
        .await
        .map_err(|e| ApiError::internal(format!("blocking task failed: {e}")))?
    }

    /// Synchronous access for tests / startup code (no executor needed).
    pub fn run_sync<T, F>(&self, f: F) -> Result<T, ApiError>
    where
        F: FnOnce(&mut Connection) -> Result<T, ApiError>,
    {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| ApiError::internal("database lock poisoned"))?;
        f(&mut guard)
    }

    /// Startup migration runner (spec item 302). Ordered, versioned,
    /// each applied in its own transaction, recorded in schema_migrations.
    fn migrate(&self) -> Result<(), ApiError> {
        self.run_sync(|conn| {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS schema_migrations (
                   version INTEGER PRIMARY KEY,
                   name TEXT NOT NULL,
                   applied_at TEXT NOT NULL
                 );",
            )?;

            for (version, name, sql) in MIGRATIONS {
                let applied: bool = conn.query_row(
                    "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
                    [version],
                    |r| r.get(0),
                )?;
                if applied {
                    continue;
                }
                let tx = conn.transaction()?;
                tx.execute_batch(sql)?;
                tx.execute(
                    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
                    rusqlite::params![version, name, now_iso()],
                )?;
                tx.commit()?;
            }
            Ok(())
        })
    }
}

/// Registered migrations — append new entries, never edit applied ones
/// (same rule as the Postgres migrations per AGENTS.md).
const MIGRATIONS: &[(u32, &str, &str)] = &[(
    1,
    "initial_core",
    include_str!("migrations/0001_initial.sql"),
)];
