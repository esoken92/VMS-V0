//! Router assembly — the /api/v1 surface this scaffold serves.
//!
//! Implemented routes mirror app/api/v1/*/route.ts one-for-one. Contract
//! routes that exist in the OpenAPI spec but are NOT yet implemented fall
//! through to an explicit 501 `not_implemented` — never a silent 404 — so
//! clients can tell "not yet ported" apart from "doesn't exist".

use axum::{
    routing::{any, get, post},
    Router,
};
use tower_http::cors::CorsLayer;

use crate::handlers::{self, AppState};

pub fn build_router(state: AppState) -> Router {
    Router::new()
        // Unauthenticated probes + the offline login extension
        .route("/api/v1/health", get(handlers::health))
        .route("/api/v1/auth/login", post(handlers::login))
        // Tier-1 core surface (spec item 305 + task brief)
        .route(
            "/api/v1/products",
            get(handlers::list_products).post(handlers::create_product),
        )
        .route("/api/v1/products/{id}", get(handlers::get_product))
        .route(
            "/api/v1/movements",
            get(handlers::list_movements).post(handlers::create_movement),
        )
        .route("/api/v1/bin-locations", get(handlers::list_bin_locations))
        .route("/api/v1/storerooms", get(handlers::list_storerooms))
        // Everything else under /api/v1 = explicitly stubbed contract routes:
        // /stock /low-stock /loans /takes /audit /reconciliation /openapi.json
        .route("/api/v1/{*rest}", any(handlers::not_implemented))
        .fallback(|| async {
            crate::error::ApiError::not_found("Route not found")
        })
        // The Tauri webview (tauri:// or localhost dev URL) and the bundled
        // frontend call this API cross-origin. Permissive is acceptable for
        // a loopback-only server; tighten to explicit origins once the shell
        // origin is fixed (tracked in docs/OFFLINE-APP.md).
        .layer(CorsLayer::permissive())
        .with_state(state)
}
