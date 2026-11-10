//! vms-offline-server — the offline backend binary.
//!
//!   vms-offline-server [--db PATH] [--bind ADDR] [--seed] [--verify-ledger]
//!
//!     --db PATH         SQLite file (default ./vms-offline.db, or $VMS_DB_PATH)
//!     --bind ADDR       listen address (default 127.0.0.1:3300, or $VMS_BIND)
//!     --seed            populate demo data where tables are empty (see seed.rs)
//!     --verify-ledger   check current_stock == Σ movements for all products,
//!                       print drift, exit non-zero on failure; then exit
//!
//! Loopback-only by default — the Tauri shell and browser dev UI are the
//! intended clients. Binding to a LAN address works but is NOT recommended:
//! auth is a single-user bearer session, there is no TLS, and the artifact
//! is designed air-gapped (spec item 307).

use std::{net::SocketAddr, path::PathBuf, process::ExitCode};

use vms_offline_server::{build_router, ops, seed, AppState, Db};

#[tokio::main]
async fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();

    let mut db_path = std::env::var("VMS_DB_PATH").unwrap_or_else(|_| "vms-offline.db".to_string());
    let mut bind = std::env::var("VMS_BIND").unwrap_or_else(|_| "127.0.0.1:3300".to_string());
    let mut do_seed = false;
    let mut verify_only = false;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--seed" => do_seed = true,
            "--verify-ledger" => verify_only = true,
            "--db" => {
                i += 1;
                match args.get(i) {
                    Some(p) => db_path = p.clone(),
                    None => return usage_fail("--db requires a path"),
                }
            }
            "--bind" => {
                i += 1;
                match args.get(i) {
                    Some(b) => bind = b.clone(),
                    None => return usage_fail("--bind requires an address"),
                }
            }
            "--help" | "-h" => {
                print_usage();
                return ExitCode::SUCCESS;
            }
            other => return usage_fail(&format!("unknown flag '{other}'")),
        }
        i += 1;
    }

    let db_path = PathBuf::from(db_path);
    let db = match Db::open(&db_path) {
        Ok(db) => db,
        Err(e) => {
            eprintln!("vms-offline-server: failed to open {}: {e}", db_path.display());
            return ExitCode::FAILURE;
        }
    };

    if do_seed {
        if let Err(e) = db.run_sync(seed::seed_demo) {
            eprintln!("vms-offline-server: seed failed: {e}");
            return ExitCode::FAILURE;
        }
        println!("vms-offline-server: demo data seeded (idempotent per-table)");
    }

    // Ledger check is part of startup hygiene and also usable standalone.
    match db.run_sync(|conn| ops::verify_ledger(conn)) {
        Ok(drift) if drift.is_empty() => {
            println!("vms-offline-server: ledger verified (current_stock = Σ movements)");
        }
        Ok(drift) => {
            eprintln!("vms-offline-server: LEDGER DRIFT detected:");
            for d in &drift {
                eprintln!(
                    "  {} ({}): current_stock={} Σ movements={}",
                    d.sku, d.product_id, d.current_stock, d.ledger_sum
                );
            }
            return ExitCode::FAILURE;
        }
        Err(e) => {
            eprintln!("vms-offline-server: ledger check failed: {e}");
            return ExitCode::FAILURE;
        }
    }
    if verify_only {
        return ExitCode::SUCCESS;
    }

    if !bind.starts_with("127.0.0.1") && !bind.starts_with("[::1]") && !bind.starts_with("localhost")
    {
        eprintln!(
            "vms-offline-server: WARNING — binding to '{bind}' exposes the API on a network \
             interface. The offline artifact is designed loopback-only (no TLS)."
        );
    }

    let addr: SocketAddr = match bind.parse() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("vms-offline-server: invalid --bind '{bind}': {e}");
            return ExitCode::FAILURE;
        }
    };
    let router = build_router(AppState { db });
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("vms-offline-server: cannot bind {addr}: {e}");
            return ExitCode::FAILURE;
        }
    };

    println!("vms-offline-server: listening on http://{addr}");
    println!("vms-offline-server: db = {}", db_path.display());
    println!("vms-offline-server: air-gapped — no outbound network calls are made");
    if let Err(e) = axum::serve(listener, router).await {
        eprintln!("vms-offline-server: serve error: {e}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}

fn print_usage() {
    eprintln!(
        "vms-offline-server [--db PATH] [--bind ADDR] [--seed] [--verify-ledger]\n\
         \n\
         \x20 --db PATH         SQLite file (default ./vms-offline.db, or $VMS_DB_PATH)\n\
         \x20 --bind ADDR       listen address (default 127.0.0.1:3300, or $VMS_BIND)\n\
         \x20 --seed            populate demo data where tables are empty\n\
         \x20 --verify-ledger   check current_stock == Σ movements, then exit"
    );
}

fn usage_fail(msg: &str) -> ExitCode {
    eprintln!("vms-offline-server: {msg}");
    print_usage();
    ExitCode::FAILURE
}
