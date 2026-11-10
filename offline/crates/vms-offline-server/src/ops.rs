//! Data ops — the SQLite port of lib/api/data.ts. Every function takes the
//! resolved Principal and re-checks the permission matrix BEFORE touching
//! the DB — identical ordering to the web artifact.
//!
//! Ledger invariant (AGENTS.md): `products.current_stock` is NEVER written
//! directly outside a movement path. `create_movement` does the movement
//! INSERT and the stock UPDATE inside ONE SQLite transaction — the same
//! guarantee lib/api/data.ts makes via db.transaction().

use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::{
    auth::{can, Permission, Principal},
    db::now_iso,
    dto::{
        BinLocationDto, MovementCreatedDto, ProductDto, StockMovementDto, StoreroomDto,
        StoreroomListDto,
    },
    error::ApiError,
    validate::{ValidMovement, ValidProduct},
};

fn clamp(n: i64, lo: i64, hi: i64) -> i64 {
    n.clamp(lo, hi)
}

// ============================================================================
// Products — apiListProducts / apiGetProduct / apiUpsertProduct
// ============================================================================

const PRODUCT_SELECT: &str = "
    SELECT p.id, p.sku, p.name, p.item_type, p.current_stock, p.min_threshold,
           p.average_cost, p.unit_of_measure, p.issuing_unit, p.bin_location_id,
           p.supplier_id, p.weight_per_unit_kg, p.carries_core_charge,
           p.core_charge_amount, p.last_movement_date,
           b.zone, b.bin_location
      FROM products p
      LEFT JOIN bin_locations b ON b.id = p.bin_location_id";

fn product_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<ProductDto> {
    Ok(ProductDto {
        id: r.get(0)?,
        sku: r.get(1)?,
        name: r.get(2)?,
        item_type: r.get(3)?,
        current_stock: r.get(4)?,
        min_threshold: r.get(5)?,
        average_cost: r.get(6)?,
        unit_of_measure: r.get(7)?,
        issuing_unit: r.get(8)?,
        bin_location_id: r.get(9)?,
        supplier_id: r.get(10)?,
        weight_per_unit_kg: r.get(11)?,
        carries_core_charge: r.get::<_, i64>(12)? != 0,
        core_charge_amount: r.get(13)?,
        last_movement_date: r.get(14)?,
        zone: r.get(15)?,
        bin_location: r.get(16)?,
    })
}

pub fn list_products(
    conn: &Connection,
    principal: &Principal,
    query: Option<&str>,
    item_type: Option<&str>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<ProductDto>, ApiError> {
    principal.require(Permission::ProductsRead)?;
    let limit = clamp(limit.unwrap_or(100), 1, 500);
    let offset = offset.unwrap_or(0).max(0);

    let mut sql = String::from(PRODUCT_SELECT);
    let mut conditions: Vec<String> = Vec::new();
    let mut bind: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(q) = query.filter(|q| !q.is_empty()) {
        conditions.push("(p.sku LIKE ? OR p.name LIKE ?)".to_string());
        let pattern = format!("%{q}%");
        bind.push(Box::new(pattern.clone()));
        bind.push(Box::new(pattern));
    }
    if let Some(t) = item_type {
        conditions.push("p.item_type = ?".to_string());
        bind.push(Box::new(t.to_string()));
    }
    if !conditions.is_empty() {
        sql.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    }
    sql.push_str(" ORDER BY p.sku ASC LIMIT ? OFFSET ?");
    bind.push(Box::new(limit));
    bind.push(Box::new(offset));

    let bind_refs: Vec<&dyn rusqlite::ToSql> = bind.iter().map(|b| b.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(bind_refs.as_slice(), product_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// apiGetProduct — `id_or_sku` resolves by uuid first, else exact SKU.
pub fn get_product(
    conn: &Connection,
    principal: &Principal,
    id_or_sku: &str,
) -> Result<ProductDto, ApiError> {
    principal.require(Permission::ProductsRead)?;
    let is_uuid = Uuid::parse_str(id_or_sku).is_ok();
    let sql = format!(
        "{PRODUCT_SELECT} WHERE {} LIMIT 1",
        if is_uuid { "p.id = ?" } else { "p.sku = ?" }
    );
    let row = conn
        .query_row(&sql, params![id_or_sku], product_from_row)
        .optional()?;
    row.ok_or_else(|| ApiError::not_found("Product not found"))
}

/// apiUpsertProduct — create path only in this scaffold (PATCH arrives with
/// the Tier-1 CRUD pass).
///
/// LEDGER NOTE (deliberate divergence from the web artifact): the web writes
/// an opening `current_stock` as a bare column value, which breaks
/// `opening + Σ movements = current_stock`. Here a non-zero opening stock is
/// recorded as an 'receiving' movement of the same amount IN THE SAME
/// transaction — the AGENTS.md "opening position is a backdated receiving
/// row" convention — so the offline ledger ALWAYS reconciles and
/// `current_stock` is never written outside a movement path.
pub fn create_product(
    conn: &mut Connection,
    principal: &Principal,
    input: &ValidProduct,
) -> Result<ProductDto, ApiError> {
    principal.require(Permission::ProductsWrite)?;

    let id = Uuid::new_v4().to_string();
    let current_stock = input.current_stock.unwrap_or(0.0);
    let now = now_iso();

    let tx = conn.transaction()?;
    let inserted = tx.execute(
        "INSERT INTO products
           (id, sku, name, item_type, current_stock, min_threshold, average_cost,
            unit_of_measure, issuing_unit, supplier_id, bin_location_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            id,
            input.sku,
            input.name,
            input.item_type,
            current_stock,
            input.min_threshold,
            input.average_cost,
            input.unit_of_measure,
            input.issuing_unit,
            input.supplier_id,
            input.bin_location_id,
        ],
    );
    match inserted {
        Ok(_) => {}
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.extended_code == 2067 => {
            // SQLITE_CONSTRAINT_UNIQUE — duplicate SKU
            return Err(ApiError::conflict(format!(
                "Product with sku '{}' already exists",
                input.sku
            )));
        }
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.extended_code == 787 => {
            // SQLITE_CONSTRAINT_FOREIGNKEY — dangling supplier/bin reference
            return Err(ApiError::validation(
                "supplier_id or bin_location_id does not reference an existing row",
            ));
        }
        Err(e) => return Err(e.into()),
    }

    // Opening balance as a ledger row (see doc comment) — keeps
    // verify_ledger at zero drift for EVERY product, not just seeded ones.
    if current_stock != 0.0 {
        tx.execute(
            "INSERT INTO stock_movements
               (id, product_id, user_id, type, quantity, reason, created_at)
             VALUES (?1, ?2, ?3, 'receiving', ?4, 'Opening balance', ?5)",
            params![
                Uuid::new_v4().to_string(),
                id,
                principal.profile_id,
                current_stock,
                now
            ],
        )?;
        tx.execute(
            "UPDATE products SET last_movement_date = ?1 WHERE id = ?2",
            params![now, id],
        )?;
    }
    tx.commit()?;
    get_product(conn, principal, &id)
}

// ============================================================================
// Stock movements — apiListMovements / apiCreateMovement
// ============================================================================

const MOVEMENT_SELECT: &str = "
    SELECT sm.id, sm.product_id, p.sku, p.name, p.unit_of_measure,
           sm.user_id, pr.full_name, sm.type, sm.quantity, sm.reason,
           sm.scrap_image_url, sm.created_at
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN profiles pr ON pr.id = sm.user_id";

fn movement_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<StockMovementDto> {
    Ok(StockMovementDto {
        id: r.get(0)?,
        product_id: r.get(1)?,
        product_sku: r.get(2)?,
        product_name: r.get(3)?,
        product_unit: r.get(4)?,
        user_id: r.get(5)?,
        user_name: r.get(6)?,
        r#type: r.get(7)?,
        quantity: r.get(8)?,
        reason: r.get(9)?,
        scrap_image_url: r.get(10)?,
        created_at: r.get(11)?,
    })
}

pub fn list_movements(
    conn: &Connection,
    principal: &Principal,
    product_id: Option<&str>,
    days: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<StockMovementDto>, ApiError> {
    principal.require(Permission::ProductsRead)?; // catalog read = movement read baseline
    let see_all = can(principal.role, Permission::StockMovementsReadAll);

    let mut sql = String::from(MOVEMENT_SELECT);
    let mut conditions: Vec<String> = Vec::new();
    let mut bind: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if !see_all {
        conditions.push("sm.user_id = ?".to_string());
        bind.push(Box::new(principal.profile_id.clone()));
    }
    if let Some(pid) = product_id {
        conditions.push("sm.product_id = ?".to_string());
        bind.push(Box::new(pid.to_string()));
    }
    if let Some(d) = days {
        let since =
            (chrono::Utc::now() - chrono::Duration::days(clamp(d, 1, 365))).to_rfc3339_opts(
                chrono::SecondsFormat::Millis,
                true,
            );
        conditions.push("sm.created_at >= ?".to_string());
        bind.push(Box::new(since));
    }
    if !conditions.is_empty() {
        sql.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    }
    sql.push_str(" ORDER BY sm.created_at DESC LIMIT ?");
    bind.push(Box::new(clamp(limit.unwrap_or(50), 1, 200)));

    let bind_refs: Vec<&dyn rusqlite::ToSql> = bind.iter().map(|b| b.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(bind_refs.as_slice(), movement_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// apiCreateMovement — the ledger write path.
///
/// Signed-quantity semantics (identical to the web):
///   inbound | receiving | adjustment → +|quantity|
///   outbound | scrap | tool_checkout → −|quantity|
///
/// Movement INSERT and `products.current_stock` UPDATE happen in ONE
/// transaction; stock can never go negative (`conflict` / 409).
pub fn create_movement(
    conn: &mut Connection,
    principal: &Principal,
    input: &ValidMovement,
) -> Result<MovementCreatedDto, ApiError> {
    // canCreateMovement() — role matrix gates the type before any DB work.
    if !crate::auth::can_create_movement(principal.role, input.r#type) {
        return Err(ApiError::forbidden(format!(
            "Role '{}' cannot record {} movements",
            principal.role.as_str(),
            input.r#type.as_str()
        )));
    }

    let signed_qty = input.r#type.signed_quantity(input.quantity);
    let movement_id = Uuid::new_v4().to_string();
    let now = now_iso();

    let tx = conn.transaction()?;

    let product: Option<(String, f64)> = tx
        .query_row(
            if input.product_id.is_some() {
                "SELECT id, current_stock FROM products WHERE id = ?1"
            } else {
                "SELECT id, current_stock FROM products WHERE sku = ?1"
            },
            params![input
                .product_id
                .clone()
                .unwrap_or_else(|| input.sku.clone().unwrap_or_default())],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let Some((product_id, current_stock)) = product else {
        return Err(ApiError::not_found("Product not found"));
    };

    let new_stock = current_stock + signed_qty;
    if new_stock < 0.0 {
        return Err(ApiError::conflict("Insufficient stock"));
    }

    tx.execute(
        "INSERT INTO stock_movements
           (id, product_id, user_id, type, quantity, reason, scrap_image_url, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            movement_id,
            product_id,
            principal.profile_id,
            input.r#type.as_str(),
            signed_qty,
            input.reason,
            input.scrap_image_url,
            now,
        ],
    )?;

    tx.execute(
        "UPDATE products SET current_stock = ?1, last_movement_date = ?2 WHERE id = ?3",
        params![new_stock, now, product_id],
    )?;

    tx.commit()?;
    Ok(MovementCreatedDto {
        movement_id,
        new_stock,
    })
}

// ============================================================================
// Bin locations — apiListBinLocations
// ============================================================================

pub fn list_bin_locations(
    conn: &Connection,
    principal: &Principal,
) -> Result<Vec<BinLocationDto>, ApiError> {
    principal.require(Permission::BinLocationsRead)?;
    let mut stmt = conn.prepare(
        "SELECT id, zone, bin_location, max_weight_kg, description
           FROM bin_locations
          ORDER BY zone ASC, bin_location ASC
          LIMIT 500",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(BinLocationDto {
                id: r.get(0)?,
                zone: r.get(1)?,
                bin_location: r.get(2)?,
                max_weight_kg: r.get(3)?,
                description: r.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

// ============================================================================
// Storerooms — apiListStorerooms. The offline schema always has the table,
// so unlike the web (which can 404 into a bin-locations fallback) this is
// always `implemented: true`.
// ============================================================================

pub fn list_storerooms(
    conn: &Connection,
    principal: &Principal,
) -> Result<StoreroomListDto, ApiError> {
    principal.require(Permission::BinLocationsRead)?;
    let mut stmt = conn.prepare(
        "SELECT id, name, type, parent_id, access_level, active
           FROM storerooms
          ORDER BY name ASC
          LIMIT 500",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(StoreroomDto {
                id: r.get(0)?,
                name: r.get(1)?,
                r#type: r.get(2)?,
                parent_id: r.get(3)?,
                access_level: r.get(4)?,
                active: r.get::<_, i64>(5)? != 0,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(StoreroomListDto {
        implemented: true,
        storerooms: rows,
    })
}

// ============================================================================
// Ledger verification — offline twin of scripts/verify-ledger.ts.
// For every product: current_stock == Σ stock_movements.quantity.
// (Opening positions are backdated 'receiving' rows, never bare column
// writes — same convention as supabase/seed.sql.)
// ============================================================================

#[derive(Debug)]
pub struct LedgerDrift {
    pub product_id: String,
    pub sku: String,
    pub current_stock: f64,
    pub ledger_sum: f64,
}

pub fn verify_ledger(conn: &Connection) -> Result<Vec<LedgerDrift>, ApiError> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.sku, p.current_stock,
                COALESCE((SELECT SUM(sm.quantity) FROM stock_movements sm
                           WHERE sm.product_id = p.id), 0) AS ledger_sum
           FROM products p",
    )?;
    let drift = stmt
        .query_map([], |r| {
            Ok(LedgerDrift {
                product_id: r.get(0)?,
                sku: r.get(1)?,
                current_stock: r.get(2)?,
                ledger_sum: r.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?
        .into_iter()
        .filter(|d| (d.current_stock - d.ledger_sum).abs() > 1e-9)
        .collect();
    Ok(drift)
}
