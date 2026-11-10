//! VMS Offline — Tauri v2 shell (spec item 300).
//!
//! ONE codebase, two shells — the UI is never forked:
//!
//! * DEV:  `devUrl` points the webview at the Next.js dev server
//!   (http://localhost:3000 — run `npm run dev` in the repo root).
//! * PROD: `frontendDist` serves bundled web assets. Two viable paths are
//!   documented in docs/OFFLINE-APP.md — a static Next.js export, or a
//!   `next start` sidecar; neither is wired up in this scaffold (dist/
//!   holds a placeholder page so the crate compiles).
//!
//! The shell also hosts the Axum API backend in-process: a std::thread with
//! its own tokio runtime serves vms-offline-server on 127.0.0.1:3300, so the
//! artifact is a single unit with zero outbound calls.

// Prevents an extra console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

use tauri::Manager;
use vms_offline_server::{build_router, seed, AppState, Db};

/// DB lives in the OS app-data dir; the file is the artifact's only state
/// (backup = copy one file — spec item 310).
fn db_path(app: &tauri::App) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("vms-offline.db")
}

/// Spawn the API backend on its own thread+runtime. The Tauri main thread
/// stays on the event loop; axum gets a dedicated single runtime.
fn spawn_api_server(path: PathBuf) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("tokio runtime");
        rt.block_on(async move {
            let db = Db::open(&path).expect("open sqlite");
            db.run_sync(seed::seed_demo)
                .expect("seed demo data on first boot");
            let listener = tokio::net::TcpListener::bind("127.0.0.1:3300")
                .await
                .expect("bind api listener");
            eprintln!("vms-offline: api listening on http://127.0.0.1:3300");
            axum::serve(listener, build_router(AppState { db }))
                .await
                .expect("api server failed");
        });
    });
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            spawn_api_server(db_path(app));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
