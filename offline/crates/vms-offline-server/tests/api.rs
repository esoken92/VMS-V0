//! HTTP-level contract checks — the same envelope + status codes a client
//! sees against the Next.js backend. Uses tower oneshot (no socket needed).

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt; // oneshot
use vms_offline_server::{build_router, seed, AppState, Db};

async fn seeded_app() -> axum::Router {
    let db = Db::open_in_memory().unwrap();
    db.run_sync(seed::seed_demo).unwrap();
    build_router(AppState { db })
}

async fn body_json(res: axum::response::Response) -> Value {
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

async fn login_token(app: &axum::Router, email: &str, password: &str) -> String {
    let res = app
        .clone()
        .oneshot(
            Request::post("/api/v1/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "email": email, "password": password }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    body_json(res).await["data"]["token"]
        .as_str()
        .unwrap()
        .to_string()
}

#[tokio::test]
async fn health_is_unauthenticated_and_shaped_like_web() {
    let app = seeded_app().await;
    let res = app
        .oneshot(Request::get("/api/v1/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "vms");
    assert_eq!(body["version"], "v1");
    assert_eq!(body["db"], "up");
    assert!(body["time"].is_string());
}

#[tokio::test]
async fn unauthenticated_requests_get_the_error_envelope() {
    let app = seeded_app().await;
    let res = app
        .oneshot(
            Request::get("/api/v1/products")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    let body = body_json(res).await;
    assert_eq!(body["error"]["code"], "unauthenticated");
    assert!(body["error"]["message"].is_string());
}

#[tokio::test]
async fn products_flow_matches_contract() {
    let app = seeded_app().await;
    let token = login_token(&app, "admin@vms-v0.local", "VmsAdmin123!").await;

    // List — {data: [...]} envelope, seeded products present.
    let res = app
        .clone()
        .oneshot(
            Request::get("/api/v1/products")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    let items = body["data"].as_array().unwrap();
    assert!(items.iter().any(|p| p["sku"] == "BRK-001"));
    assert!(items.iter().all(|p| p["zone"].is_null() || p["zone"].is_string()));

    // Filter by sku substring + item_type.
    let res = app
        .clone()
        .oneshot(
            Request::get("/api/v1/products?q=BRK&item_type=consumable")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = body_json(res).await;
    assert!(body["data"]
        .as_array()
        .unwrap()
        .iter()
        .all(|p| p["item_type"] == "consumable"));

    // Create (admin holds products:write).
    let res = app
        .clone()
        .oneshot(
            Request::post("/api/v1/products")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "sku": "NEW-001", "name": "New Widget", "item_type": "consumable",
                        "min_threshold": 2, "average_cost": 9.5,
                        "unit_of_measure": "Each", "issuing_unit": "Each"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert_eq!(body["data"]["sku"], "NEW-001");
    assert_eq!(body["data"]["current_stock"], 0.0);

    // Duplicate SKU → 409 conflict envelope.
    let res = app
        .clone()
        .oneshot(
            Request::post("/api/v1/products")
                .header("authorization", format!("Bearer {token}"))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "sku": "NEW-001", "name": "Dupe", "item_type": "consumable",
                        "min_threshold": 0, "average_cost": 0,
                        "unit_of_measure": "Each", "issuing_unit": "Each"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);
    assert_eq!(body_json(res).await["error"]["code"], "conflict");

    // Get by SKU path (apiGetProduct's id-or-sku semantics).
    let res = app
        .clone()
        .oneshot(
            Request::get("/api/v1/products/NEW-001")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(body_json(res).await["data"]["name"], "New Widget");
}

#[tokio::test]
async fn movement_post_enforces_role_matrix_and_signing() {
    let app = seeded_app().await;

    // staff CAN record receiving; fleet_dispatch CANNOT.
    let staff_token = login_token(&app, "worker@vms-v0.local", "VmsWorker123!").await;
    let fleet_token = login_token(&app, "fleet@vms-v0.local", "VmsFleet123!").await;

    let res = app
        .clone()
        .oneshot(
            Request::post("/api/v1/movements")
                .header("authorization", format!("Bearer {staff_token}"))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "sku": "BRK-001", "type": "receiving", "quantity": 10 })
                        .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert_eq!(body["data"]["new_stock"], 160.0); // seeded opening was 150
    assert!(body["data"]["movement_id"].is_string());

    // fleet_dispatch receiving → 403 forbidden.
    let res = app
        .clone()
        .oneshot(
            Request::post("/api/v1/movements")
                .header("authorization", format!("Bearer {fleet_token}"))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "sku": "BRK-001", "type": "receiving", "quantity": 1 }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
    assert_eq!(body_json(res).await["error"]["code"], "forbidden");

    // outbound past zero → 409 conflict.
    let admin_token = login_token(&app, "admin@vms-v0.local", "VmsAdmin123!").await;
    let res = app
        .clone()
        .oneshot(
            Request::post("/api/v1/movements")
                .header("authorization", format!("Bearer {admin_token}"))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "sku": "BRK-001", "type": "outbound", "quantity": 9999 })
                        .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);
    assert_eq!(body_json(res).await["error"]["code"], "conflict");

    // Movement list for admin shows signed negatives.
    let res = app
        .clone()
        .oneshot(
            Request::get("/api/v1/movements?limit=50")
                .header("authorization", format!("Bearer {admin_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = body_json(res).await;
    let rows = body["data"].as_array().unwrap();
    let recv = rows.iter().find(|m| m["type"] == "receiving" && m["quantity"] == 10.0);
    assert!(recv.is_some(), "expected the +10 receiving row in ledger");
}

#[tokio::test]
async fn bin_locations_and_storerooms() {
    let app = seeded_app().await;
    let token = login_token(&app, "worker@vms-v0.local", "VmsWorker123!").await;

    let res = app
        .clone()
        .oneshot(
            Request::get("/api/v1/bin-locations")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert!(body["data"].as_array().unwrap().iter().any(|b| b["zone"] == "Zone A"));

    let res = app
        .clone()
        .oneshot(
            Request::get("/api/v1/storerooms")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body = body_json(res).await;
    assert_eq!(body["data"]["implemented"], true);
    assert!(body["data"]["storerooms"].as_array().unwrap().iter().any(|s| s["name"] == "Tool Cage"));
}

#[tokio::test]
async fn unimplemented_contract_routes_are_explicit_501() {
    let app = seeded_app().await;
    let token = login_token(&app, "admin@vms-v0.local", "VmsAdmin123!").await;

    for path in [
        "/api/v1/stock",
        "/api/v1/low-stock",
        "/api/v1/loans",
        "/api/v1/takes",
        "/api/v1/audit",
        "/api/v1/reconciliation",
        "/api/v1/openapi.json",
    ] {
        let res = app
            .clone()
            .oneshot(
                Request::get(path)
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_IMPLEMENTED, "{path}");
        assert_eq!(body_json(res).await["error"]["code"], "not_implemented", "{path}");
    }
}
