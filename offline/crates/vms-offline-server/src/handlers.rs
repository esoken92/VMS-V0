//! Axum handlers for the /api/v1 surface. Ordering inside every handler
//! mirrors lib/api/handler.ts + the route files: resolve principal →
//! validate input → data op (which re-checks the permission matrix).

use axum::{
    body::Bytes,
    extract::{FromRequestParts, Path, RawQuery, State},
    http::{request::Parts, HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Response},
    Json,
};
use serde::de::DeserializeOwned;
use serde_json::json;

use crate::{
    auth::{self, Principal},
    db::{now_iso, Db},
    dto::{LoginProfileDto, LoginResponseDto},
    error::{data, ApiError, ApiErrorCode},
    ops,
    validate::{
        CreateMovementBody, LoginBody, MovementListQuery, ProductListQuery, UpsertProductBody,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
}

// ============================================================================
// Extractors
// ============================================================================

/// Bearer-token → Principal. Equivalent of resolveApiPrincipal() for the
/// offline session path (lib/api/auth.ts).
impl FromRequestParts<AppState> for Principal {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        state
            .db
            .run(move |conn| auth::resolve_bearer(conn, header.as_deref()))
            .await
    }
}

/// parseJsonBody equivalent — syntax failures get the web's exact message;
/// type/shape mismatches get the Zod-style prefix.
fn parse_json<T: DeserializeOwned>(body: &Bytes) -> Result<T, ApiError> {
    serde_json::from_slice::<T>(body).map_err(|e| {
        if e.is_syntax() || e.is_eof() {
            ApiError::validation("Request body is not valid JSON")
        } else {
            ApiError::validation(format!("Invalid request body: {e}"))
        }
    })
}

fn parse_query<T: DeserializeOwned>(raw: Option<&str>) -> Result<T, ApiError> {
    serde_urlencoded::from_str(raw.unwrap_or(""))
        .map_err(|e| ApiError::validation(format!("Invalid query parameters: {e}")))
}

// ============================================================================
// GET /api/v1/health — unauthenticated liveness/readiness probe.
// Shape identical to app/api/v1/health/route.ts.
// ============================================================================

pub async fn health(State(state): State<AppState>) -> Response {
    let up = state
        .db
        .run(|conn| Ok(conn.query_row("SELECT 1", [], |r| r.get::<_, i64>(0))?))
        .await
        .map(|v| v == 1)
        .unwrap_or(false);

    (
        if up {
            StatusCode::OK
        } else {
            StatusCode::SERVICE_UNAVAILABLE
        },
        Json(json!({
            "status": if up { "ok" } else { "degraded" },
            "service": "vms",
            "version": "v1",
            "db": if up { "up" } else { "down" },
            "time": now_iso(),
        })),
    )
        .into_response()
}

// ============================================================================
// POST /api/v1/auth/login — OFFLINE EXTENSION (the web artifact logs in via
// the Auth.js /login page + session cookie, not a REST route).
// Body: {email, password} → {data: {token, profile:{id,email,full_name,role}}}
// ============================================================================

pub async fn login(State(state): State<AppState>, body: Bytes) -> Result<Response, ApiError> {
    let (email, password) = parse_json::<LoginBody>(&body)?.validate()?;
    let result = state
        .db
        .run(move |conn| auth::login(conn, &email, &password))
        .await?;
    Ok(data(LoginResponseDto {
        token: result.token,
        profile: LoginProfileDto {
            id: result.profile_id,
            email: result.email,
            full_name: result.full_name,
            role: result.role.as_str().to_string(),
        },
    })
    .into_response())
}

// ============================================================================
// /api/v1/products — GET list (productListQuery), POST create (write perm)
// ============================================================================

pub async fn list_products(
    State(state): State<AppState>,
    principal: Principal,
    RawQuery(raw): RawQuery,
) -> Result<Response, ApiError> {
    let query = parse_query::<ProductListQuery>(raw.as_deref())?.validate()?;
    let items = state
        .db
        .run(move |conn| {
            ops::list_products(
                conn,
                &principal,
                query.q.as_deref(),
                query.item_type.as_deref(),
                query.limit,
                query.offset,
            )
        })
        .await?;
    Ok(data(items).into_response())
}

pub async fn get_product(
    State(state): State<AppState>,
    principal: Principal,
    Path(id_or_sku): Path<String>,
) -> Result<Response, ApiError> {
    let product = state
        .db
        .run(move |conn| ops::get_product(conn, &principal, &id_or_sku))
        .await?;
    Ok(data(product).into_response())
}

pub async fn create_product(
    State(state): State<AppState>,
    principal: Principal,
    body: Bytes,
) -> Result<Response, ApiError> {
    let input = parse_json::<UpsertProductBody>(&body)?.validate()?;
    let product = state
        .db
        .run(move |conn| ops::create_product(conn, &principal, &input))
        .await?;
    Ok((StatusCode::CREATED, data(product)).into_response())
}

// ============================================================================
// /api/v1/movements — GET ledger (movementListQuery), POST append
// ============================================================================

pub async fn list_movements(
    State(state): State<AppState>,
    principal: Principal,
    RawQuery(raw): RawQuery,
) -> Result<Response, ApiError> {
    let query = parse_query::<MovementListQuery>(raw.as_deref())?.validate()?;
    let items = state
        .db
        .run(move |conn| {
            ops::list_movements(conn, &principal, query.product_id.as_deref(), query.days, query.limit)
        })
        .await?;
    Ok(data(items).into_response())
}

pub async fn create_movement(
    State(state): State<AppState>,
    principal: Principal,
    body: Bytes,
) -> Result<Response, ApiError> {
    let input = parse_json::<CreateMovementBody>(&body)?.validate()?;
    let result = state
        .db
        .run(move |conn| ops::create_movement(conn, &principal, &input))
        .await?;
    Ok((StatusCode::CREATED, data(result)).into_response())
}

// ============================================================================
// GET /api/v1/bin-locations — OFFLINE EXTENSION of the REST surface (on the
// web, apiListBinLocations is reachable via MCP tools, not a REST route;
// Tier-1 "bin/storeroom views" needs it REST-side here).
// ============================================================================

pub async fn list_bin_locations(
    State(state): State<AppState>,
    principal: Principal,
) -> Result<Response, ApiError> {
    let items = state
        .db
        .run(move |conn| ops::list_bin_locations(conn, &principal))
        .await?;
    Ok(data(items).into_response())
}

// ============================================================================
// GET /api/v1/storerooms — apiListStorerooms. Always `implemented: true`
// here since the offline schema ships the table.
// ============================================================================

pub async fn list_storerooms(
    State(state): State<AppState>,
    principal: Principal,
) -> Result<Response, ApiError> {
    let result = state
        .db
        .run(move |conn| ops::list_storerooms(conn, &principal))
        .await?;
    Ok(data(result).into_response())
}

// ============================================================================
// Contract routes not yet implemented — explicit honest stub. Every route in
// the shared spec that this scaffold does not serve yet falls through to
// this handler instead of a silent 404 (see docs/OFFLINE-APP.md matrix).
// ============================================================================

pub async fn not_implemented(uri: Uri, _headers: HeaderMap) -> ApiError {
    ApiError::with_status(
        ApiErrorCode::NotImplemented,
        format!(
            "{} is not implemented in the offline artifact yet — see the route-parity matrix in docs/OFFLINE-APP.md",
            uri.path()
        ),
        StatusCode::NOT_IMPLEMENTED,
    )
}
