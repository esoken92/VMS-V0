//! vms-offline-server — Axum + SQLite backend for the VMS offline artifact.
//!
//! Implements the same `/api/v1` REST contract as the Next.js backend
//! (lib/api/*, app/api/v1/*) over a local SQLite database, with zero
//! outbound network calls (spec items 300–303).
//!
//! Library-first layout: `main.rs` is a thin binary over `build_router`;
//! tests exercise the data ops directly on `&mut Connection`.

pub mod auth;
pub mod db;
pub mod dto;
pub mod error;
pub mod handlers;
pub mod ops;
pub mod routes;
pub mod seed;
pub mod validate;

pub use db::{now_iso, Db};
pub use handlers::AppState;
pub use routes::build_router;
