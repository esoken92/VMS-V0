//! Demo seed (`--seed`) — compact port of supabase/seed.sql + the argon2id
//! hashing step from scripts/seed.ts. Idempotent: skips any table that
//! already has rows.
//!
//! Same well-known credentials as the web seed — LOCAL DEMO DATA ONLY,
//! identical security caveat as supabase/seed.sql.
//!
//! Ledger convention (mirrors supabase/seed.sql): each seeded product gets
//! ONE backdated 'receiving' movement equal to its opening current_stock,
//! so `opening + Σ movements = current_stock` reconciles from rows alone —
//! verifiable via `--verify-ledger` or ops::verify_ledger().

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::{auth, db::now_iso, error::ApiError};

const ADMIN_ID: &str = "a0000000-0000-4000-8000-000000000001";
const MANAGER_ID: &str = "a0000000-0000-4000-8000-000000000002";
const FLEET_ID: &str = "a0000000-0000-4000-8000-000000000003";
const WORKER_ID: &str = "a0000000-0000-4000-8000-000000000004";

pub struct SeedUser {
    pub id: &'static str,
    pub email: &'static str,
    pub password: &'static str,
    pub full_name: &'static str,
    pub role: &'static str,
}

/// Same accounts as scripts/seed.ts SEED_USERS.
pub const SEED_USERS: &[SeedUser] = &[
    SeedUser {
        id: ADMIN_ID,
        email: "admin@vms-v0.local",
        password: "VmsAdmin123!",
        full_name: "VMS Admin",
        role: "super_admin",
    },
    SeedUser {
        id: MANAGER_ID,
        email: "manager@vms-v0.local",
        password: "VmsManager123!",
        full_name: "VMS Manager",
        role: "manager",
    },
    SeedUser {
        id: FLEET_ID,
        email: "fleet@vms-v0.local",
        password: "VmsFleet123!",
        full_name: "VMS Fleet Dispatch",
        role: "fleet_dispatch",
    },
    SeedUser {
        id: WORKER_ID,
        email: "worker@vms-v0.local",
        password: "VmsWorker123!",
        full_name: "VMS Worker",
        role: "staff",
    },
];

fn is_empty(conn: &Connection, table: &str) -> Result<bool, ApiError> {
    let n: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?;
    Ok(n == 0)
}

/// Seed just the 4 demo profiles — also used by tests to bootstrap auth.
pub fn seed_profiles(conn: &Connection) -> Result<(), ApiError> {
    if !is_empty(conn, "profiles")? {
        return Ok(());
    }
    for u in SEED_USERS {
        let hash = auth::hash_password(u.password)?;
        // profiles.id == user_id (1:1 identity convention from the web seed).
        conn.execute(
            "INSERT INTO profiles (id, user_id, email, role, full_name, password_hash, created_at, updated_at)
             VALUES (?1, ?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![u.id, u.email, u.role, u.full_name, hash, now_iso()],
        )?;
    }
    Ok(())
}

fn seed_suppliers(conn: &Connection) -> Result<(), ApiError> {
    if !is_empty(conn, "suppliers")? {
        return Ok(());
    }
    for (name, email, phone, address) in [
        ("AutoParts Direct", "orders@autopartsdirect.com", "+1-555-0101", "123 Industrial Blvd, Detroit, MI 48201"),
        ("ToolMaster Supply", "sales@toolmaster.com", "+1-555-0102", "456 Tool Lane, Chicago, IL 60601"),
        ("Tire Kingdom", "orders@tirekingdom.com", "+1-555-0104", "321 Rubber St, Akron, OH 44301"),
    ] {
        conn.execute(
            "INSERT INTO suppliers (id, name, contact_email, phone, address) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![Uuid::new_v4().to_string(), name, email, phone, address],
        )?;
    }
    Ok(())
}

fn seed_storerooms(conn: &Connection) -> Result<(), ApiError> {
    if !is_empty(conn, "storerooms")? {
        return Ok(());
    }
    for (name, rtype, desc, access) in [
        ("Main Storeroom", "general", "Primary parts storage", "open"),
        ("Cold Store", "cold", "Temperature-controlled fluids", "restricted"),
        ("Tool Cage", "secure", "Issued tooling cage", "restricted"),
    ] {
        conn.execute(
            "INSERT INTO storerooms (id, name, type, description, access_level)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![Uuid::new_v4().to_string(), name, rtype, desc, access],
        )?;
    }
    Ok(())
}

fn seed_bin_locations(conn: &Connection) -> Result<(), ApiError> {
    if !is_empty(conn, "bin_locations")? {
        return Ok(());
    }
    for (zone, bin, weight, desc) in [
        ("Zone A", "A1", 500.0_f64, "Small parts storage"),
        ("Zone A", "A2", 500.0, "Small parts storage"),
        ("Zone B", "B1", 1000.0, "Medium parts storage"),
        ("Zone B", "B2", 1000.0, "Medium parts storage"),
        ("Zone C", "C1", 2000.0, "Large parts and tools"),
        ("Zone C", "C2", 2000.0, "Large parts and tools"),
    ] {
        conn.execute(
            "INSERT INTO bin_locations (id, zone, bin_location, max_weight_kg, description)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![Uuid::new_v4().to_string(), zone, bin, weight, desc],
        )?;
    }
    Ok(())
}

/// (sku, name, item_type, opening_stock, min_threshold, uom, issuing_unit, bin, supplier, avg_cost)
type ProductSeed<'a> = (
    &'a str,
    &'a str,
    &'a str,
    f64,
    f64,
    &'a str,
    &'a str,
    &'a str,
    &'a str,
    f64,
);

fn seed_products_and_openings(conn: &mut Connection) -> Result<(), ApiError> {
    if !is_empty(conn, "products")? {
        return Ok(());
    }
    let products: &[ProductSeed<'_>] = &[
        ("BRK-001", "Brake Pads - Front", "consumable", 150.0, 20.0, "Pair", "Pair", "A1", "AutoParts Direct", 25.0),
        ("FLT-001", "Oil Filter - Standard", "consumable", 200.0, 30.0, "Each", "Each", "A2", "AutoParts Direct", 8.0),
        ("OIL-001", "Motor Oil 5W-30 - 5qt", "fluid", 80.0, 15.0, "Case", "Quart", "B1", "AutoParts Direct", 35.0),
        ("TL-001", "Impact Wrench - 1/2in", "tool", 15.0, 3.0, "Each", "Each", "C1", "ToolMaster Supply", 150.0),
        ("TL-002", "Impact Wrench - 3/8in", "tool", 12.0, 3.0, "Each", "Each", "C2", "ToolMaster Supply", 120.0),
        ("TIR-001", "Tire 205/55R16", "tire", 40.0, 8.0, "Each", "Each", "C1", "Tire Kingdom", 120.0),
    ];

    let tx = conn.transaction()?;
    for (sku, name, item_type, opening, min_thr, uom, issuing, bin, supplier, cost) in products {
        let product_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO products
               (id, sku, name, item_type, current_stock, min_threshold, average_cost,
                unit_of_measure, issuing_unit, bin_location_id, supplier_id, last_movement_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                     (SELECT id FROM bin_locations WHERE zone || '-' || bin_location = ?10
                         OR bin_location = ?10 LIMIT 1),
                     (SELECT id FROM suppliers WHERE name = ?11), ?12)",
            params![
                product_id,
                sku,
                name,
                item_type,
                opening,
                min_thr,
                cost,
                uom,
                issuing,
                bin,
                supplier,
                now_iso()
            ],
        )?;
        // Opening balance — a backdated 'receiving' movement equal to the
        // opening stock, so the ledger reconciles (AGENTS.md convention).
        let backdated = (chrono::Utc::now() - chrono::Duration::days(60))
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        tx.execute(
            "INSERT INTO stock_movements
               (id, product_id, user_id, type, quantity, reason, created_at)
             VALUES (?1, ?2, ?3, 'receiving', ?4, 'Opening balance', ?5)",
            params![
                Uuid::new_v4().to_string(),
                product_id,
                ADMIN_ID,
                opening,
                backdated
            ],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Run all seed sections. Each skips itself when its table is non-empty.
pub fn seed_demo(conn: &mut Connection) -> Result<(), ApiError> {
    seed_profiles(conn)?;
    seed_suppliers(conn)?;
    seed_storerooms(conn)?;
    seed_bin_locations(conn)?;
    seed_products_and_openings(conn)
}
