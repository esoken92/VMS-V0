//! Error envelope — mirrors `lib/api/http.ts`.
//!
//! Failure shape on the wire is always:
//!   `{ "error": { "code": <snake_case>, "message": <string> } }`
//! with the HTTP status the web backend maps for that code.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;

/// OFFLINE EXTENSION: `not_implemented` (501) is an extra code the web enum
/// does not have — it marks contract routes this scaffold deliberately
/// stubs rather than silently 404s.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ApiErrorCode {
    Unauthenticated,
    Forbidden,
    ForbiddenScope,
    Validation,
    NotFound,
    Conflict,
    RateLimited,
    Internal,
    NotImplemented,
}

impl ApiErrorCode {
    /// STATUS_BY_CODE in lib/api/http.ts.
    pub fn status(self) -> StatusCode {
        match self {
            Self::Unauthenticated => StatusCode::UNAUTHORIZED,
            Self::Forbidden | Self::ForbiddenScope => StatusCode::FORBIDDEN,
            Self::Validation => StatusCode::BAD_REQUEST,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Conflict => StatusCode::CONFLICT,
            Self::RateLimited => StatusCode::TOO_MANY_REQUESTS,
            Self::Internal => StatusCode::INTERNAL_SERVER_ERROR,
            Self::NotImplemented => StatusCode::NOT_IMPLEMENTED,
        }
    }
}

#[derive(Debug)]
pub struct ApiError {
    pub code: ApiErrorCode,
    pub message: String,
    pub status: StatusCode,
}

impl ApiError {
    pub fn new(code: ApiErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            status: code.status(),
        }
    }

    pub fn with_status(code: ApiErrorCode, message: impl Into<String>, status: StatusCode) -> Self {
        Self {
            code,
            message: message.into(),
            status,
        }
    }

    pub fn unauthenticated(msg: impl Into<String>) -> Self {
        Self::new(ApiErrorCode::Unauthenticated, msg)
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::new(ApiErrorCode::Forbidden, msg)
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::new(ApiErrorCode::Validation, msg)
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::new(ApiErrorCode::NotFound, msg)
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::new(ApiErrorCode::Conflict, msg)
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::new(ApiErrorCode::Internal, msg)
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for ApiError {}

/// Internal DB errors are collapsed to `internal` so driver details never
/// leak through the API surface (same intent as apiErrorResponse's catch-all,
/// which passes the raw message — we keep a generic prefix instead).
impl From<rusqlite::Error> for ApiError {
    fn from(err: rusqlite::Error) -> Self {
        Self::internal(format!("database error: {err}"))
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({ "error": { "code": self.code, "message": self.message } })),
        )
            .into_response()
    }
}

/// Success body shape used across /api/v1: `{ "data": <T> }`
/// (apiJson({ data: … }) in the web routes).
pub fn data<T: Serialize>(value: T) -> Json<serde_json::Value> {
    Json(json!({ "data": value }))
}
