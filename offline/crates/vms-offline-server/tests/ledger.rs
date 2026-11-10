//! Ledger invariant + movement semantics — the offline twin of
//! `npx tsx scripts/verify-ledger.ts`: opening + Σ movements = current_stock.
//!
//! Exercises ops::* directly on an in-memory database (no HTTP needed).

use vms_offline_server::{
    auth::{Principal, Role},
    error::ApiErrorCode,
    ops,
    seed,
    validate::{ValidMovement, ValidProduct},
    Db,
};

fn principal(id: &str, role: Role) -> Principal {
    Principal {
        profile_id: id.to_string(),
        role,
        full_name: "Test User".to_string(),
    }
}

fn movement(product_id: Option<&str>, sku: Option<&str>, mtype: &str, qty: f64) -> ValidMovement {
    ValidMovement {
        product_id: product_id.map(String::from),
        sku: sku.map(String::from),
        r#type: vms_offline_server::auth::MovementType::parse(mtype).unwrap(),
        quantity: qty,
        reason: None,
        scrap_image_url: None,
    }
}

fn test_product(sku: &str, opening: f64) -> ValidProduct {
    ValidProduct {
        sku: sku.to_string(),
        name: format!("{sku} name"),
        item_type: "consumable".to_string(),
        current_stock: Some(opening),
        min_threshold: 0.0,
        average_cost: 1.0,
        unit_of_measure: "Each".to_string(),
        issuing_unit: "Each".to_string(),
        supplier_id: None,
        bin_location_id: None,
    }
}

#[test]
fn movement_signing_and_stock_update_in_one_tx() {
    let db = Db::open_in_memory().unwrap();
    db.run_sync(|conn| seed::seed_profiles(conn)).unwrap();

    let admin = principal(seed::SEED_USERS[0].id, Role::SuperAdmin);

    db.run_sync(|conn| {
        // Create a product with NO opening stock — the ledger must start at 0.
        let created = ops::create_product(conn, &admin, &test_product("LED-001", 0.0))?;
        assert_eq!(created.current_stock, 0.0);

        // +10 receiving
        let r = ops::create_movement(conn, &admin, &movement(None, Some("LED-001"), "receiving", 10.0))?;
        assert_eq!(r.new_stock, 10.0);
        // +5 inbound
        let r = ops::create_movement(conn, &admin, &movement(None, Some("LED-001"), "inbound", 5.0))?;
        assert_eq!(r.new_stock, 15.0);
        // −3 outbound (stored as −3)
        let r = ops::create_movement(conn, &admin, &movement(None, Some("LED-001"), "outbound", 3.0))?;
        assert_eq!(r.new_stock, 12.0);
        // −2 scrap
        let r = ops::create_movement(conn, &admin, &movement(None, Some("LED-001"), "scrap", 2.0))?;
        assert_eq!(r.new_stock, 10.0);

        // Signed storage check: outbound/scrap rows hold NEGATIVE quantities.
        let signed: Vec<(String, f64)> = conn
            .prepare("SELECT type, quantity FROM stock_movements ORDER BY created_at, rowid")?
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<Result<_, _>>()?;
        assert_eq!(
            signed,
            vec![
                ("receiving".to_string(), 10.0),
                ("inbound".to_string(), 5.0),
                ("outbound".to_string(), -3.0),
                ("scrap".to_string(), -2.0),
            ]
        );
        Ok(())
    })
    .unwrap();

    // The verify-ledger contract: current_stock == Σ movements per product.
    db.run_sync(|conn| {
        let drift = ops::verify_ledger(conn)?;
        assert!(drift.is_empty(), "ledger drift: {drift:?}");
        Ok(())
    })
    .unwrap();
}

#[test]
fn insufficient_stock_is_a_conflict() {
    let db = Db::open_in_memory().unwrap();
    db.run_sync(|conn| seed::seed_profiles(conn)).unwrap();
    let admin = principal(seed::SEED_USERS[0].id, Role::SuperAdmin);

    db.run_sync(|conn| {
        ops::create_product(conn, &admin, &test_product("LED-002", 5.0))?;
        let err =
            ops::create_movement(conn, &admin, &movement(None, Some("LED-002"), "outbound", 10.0))
                .unwrap_err();
        assert_eq!(err.code, ApiErrorCode::Conflict);
        assert!(err.message.contains("Insufficient stock"));

        // And stock is untouched (transaction rolled back).
        let p = ops::get_product(conn, &admin, "LED-002")?;
        assert_eq!(p.current_stock, 5.0);
        Ok(())
    })
    .unwrap();
}

#[test]
fn role_matrix_gates_movement_types() {
    let db = Db::open_in_memory().unwrap();
    db.run_sync(|conn| seed::seed_profiles(conn)).unwrap();

    let staff = principal(seed::SEED_USERS[3].id, Role::Staff);
    let fleet = principal(seed::SEED_USERS[2].id, Role::FleetDispatch);

    db.run_sync(|conn| {
        let admin = principal(seed::SEED_USERS[0].id, Role::SuperAdmin);
        ops::create_product(conn, &admin, &test_product("LED-003", 20.0))?;

        // staff CAN record inbound/receiving/adjustment…
        let r =
            ops::create_movement(conn, &staff, &movement(None, Some("LED-003"), "inbound", 1.0))?;
        assert_eq!(r.new_stock, 21.0);
        // …but NOT outbound.
        let err =
            ops::create_movement(conn, &staff, &movement(None, Some("LED-003"), "outbound", 1.0))
                .unwrap_err();
        assert_eq!(err.code, ApiErrorCode::Forbidden);

        // fleet_dispatch can issue outbound but not receive.
        let r = ops::create_movement(
            conn,
            &fleet,
            &movement(None, Some("LED-003"), "outbound", 2.0),
        )?;
        assert_eq!(r.new_stock, 19.0);
        let err = ops::create_movement(
            conn,
            &fleet,
            &movement(None, Some("LED-003"), "receiving", 1.0),
        )
        .unwrap_err();
        assert_eq!(err.code, ApiErrorCode::Forbidden);
        Ok(())
    })
    .unwrap();
}

#[test]
fn movements_scope_own_rows_without_read_all() {
    let db = Db::open_in_memory().unwrap();
    db.run_sync(|conn| seed::seed_profiles(conn)).unwrap();

    db.run_sync(|conn| {
        let admin = principal(seed::SEED_USERS[0].id, Role::SuperAdmin);
        let staff = principal(seed::SEED_USERS[3].id, Role::Staff);
        let fleet = principal(seed::SEED_USERS[2].id, Role::FleetDispatch);

        ops::create_product(conn, &admin, &test_product("LED-004", 50.0))?;
        ops::create_movement(conn, &staff, &movement(None, Some("LED-004"), "inbound", 1.0))?;
        ops::create_movement(conn, &fleet, &movement(None, Some("LED-004"), "outbound", 1.0))?;

        // Admin (stock_movements:read:all) sees all 3 rows: the 'receiving'
        // opening balance written by create_product + staff + fleet rows.
        let all = ops::list_movements(conn, &admin, None, None, None)?;
        assert_eq!(all.len(), 3);
        // Staff sees only their own row.
        let own = ops::list_movements(conn, &staff, None, None, None)?;
        assert_eq!(own.len(), 1);
        assert_eq!(own[0].r#type, "inbound");
        Ok(())
    })
    .unwrap();
}

#[test]
fn seeded_demo_db_reconciles() {
    // The --seed dataset must pass verify-ledger out of the box.
    let db = Db::open_in_memory().unwrap();
    db.run_sync(seed::seed_demo).unwrap();
    db.run_sync(|conn| {
        assert!(ops::verify_ledger(conn)?.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn login_verify_and_bearer_round_trip() {
    let db = Db::open_in_memory().unwrap();
    db.run_sync(|conn| seed::seed_profiles(conn)).unwrap();

    db.run_sync(|conn| {
        // Bad password → single ambiguous 401 (no user enumeration).
        let err = vms_offline_server::auth::login(
            conn,
            "admin@vms-v0.local",
            "wrong-password",
        )
        .unwrap_err();
        assert_eq!(err.code, ApiErrorCode::Unauthenticated);
        let err =
            vms_offline_server::auth::login(conn, "nobody@vms-v0.local", "x").unwrap_err();
        assert_eq!(err.code, ApiErrorCode::Unauthenticated);

        // Good credentials → token resolves to the right principal.
        let res =
            vms_offline_server::auth::login(conn, "ADMIN@vms-v0.local", "VmsAdmin123!")?;
        assert!(res.token.starts_with("vms_off_"));
        assert_eq!(res.role, Role::SuperAdmin);

        let p = vms_offline_server::auth::resolve_bearer(
            conn,
            Some(&format!("Bearer {}", res.token)),
        )?;
        assert_eq!(p.profile_id, seed::SEED_USERS[0].id);

        let err = vms_offline_server::auth::resolve_bearer(conn, Some("Bearer nope"))
            .unwrap_err();
        assert_eq!(err.code, ApiErrorCode::Unauthenticated);
        let err =
            vms_offline_server::auth::resolve_bearer(conn, None).unwrap_err();
        assert_eq!(err.code, ApiErrorCode::Unauthenticated);
        Ok(())
    })
    .unwrap();
}
