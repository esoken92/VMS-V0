//! Input validation — the serde+manual equivalent of lib/api/schemas.ts
//! (Zod at every boundary). Messages follow the web's envelope text:
//! `Invalid request body: <field>: <problem>`.

use serde::Deserialize;
use uuid::Uuid;

use crate::{auth::ITEM_TYPES, error::ApiError};

fn fail(field: &str, problem: impl std::fmt::Display) -> ApiError {
    ApiError::validation(format!("Invalid request body: {field}: {problem}"))
}

fn require_len(field: &str, v: &str, min: usize, max: usize) -> Result<String, ApiError> {
    let v = v.trim();
    if v.len() < min {
        return Err(fail(field, format!("must contain at least {min} character(s)")));
    }
    if v.len() > max {
        return Err(fail(field, format!("must contain at most {max} character(s)")));
    }
    Ok(v.to_string())
}

fn opt_len(field: &str, v: &Option<String>, max: usize) -> Result<Option<String>, ApiError> {
    match v {
        Some(s) if s.len() > max => Err(fail(field, format!("must contain at most {max} character(s)"))),
        other => Ok(other.clone()),
    }
}

fn require_nonneg(field: &str, v: f64) -> Result<(), ApiError> {
    if !v.is_finite() || v < 0.0 {
        Err(fail(field, "must be >= 0"))
    } else {
        Ok(())
    }
}

fn opt_uuid(field: &str, v: &Option<String>) -> Result<Option<String>, ApiError> {
    match v {
        None => Ok(None),
        Some(s) => Uuid::parse_str(s)
            .map(|u| u.to_string())
            .map(Some)
            .map_err(|_| fail(field, "must be a valid uuid")),
    }
}

fn is_uuid(s: &str) -> bool {
    Uuid::parse_str(s).is_ok()
}

// ============================================================================
// POST /api/v1/auth/login — credentialsSchema in auth.ts (email ≤320, pw ≤200)
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct LoginBody {
    pub email: Option<String>,
    pub password: Option<String>,
}

impl LoginBody {
    pub fn validate(self) -> Result<(String, String), ApiError> {
        let email = self
            .email
            .filter(|e| !e.trim().is_empty())
            .ok_or_else(|| fail("email", "is required"))?;
        if email.len() > 320 || !email.contains('@') {
            return Err(fail("email", "must be a valid email"));
        }
        let password = self
            .password
            .filter(|p| !p.is_empty())
            .ok_or_else(|| fail("password", "is required"))?;
        if password.len() > 200 {
            return Err(fail("password", "must contain at most 200 character(s)"));
        }
        Ok((email, password))
    }
}

// ============================================================================
// POST /api/v1/products — upsertProductBody in lib/api/schemas.ts
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct UpsertProductBody {
    pub sku: Option<String>,
    pub name: Option<String>,
    pub item_type: Option<String>,
    pub current_stock: Option<f64>,
    pub min_threshold: Option<f64>,
    pub average_cost: Option<f64>,
    pub unit_of_measure: Option<String>,
    pub issuing_unit: Option<String>,
    pub supplier_id: Option<String>,
    pub bin_location_id: Option<String>,
}

pub struct ValidProduct {
    pub sku: String,
    pub name: String,
    pub item_type: String,
    pub current_stock: Option<f64>,
    pub min_threshold: f64,
    pub average_cost: f64,
    pub unit_of_measure: String,
    pub issuing_unit: String,
    pub supplier_id: Option<String>,
    pub bin_location_id: Option<String>,
}

impl UpsertProductBody {
    pub fn validate(self) -> Result<ValidProduct, ApiError> {
        let sku = require_len("sku", &self.sku.unwrap_or_default(), 1, 100)?;
        let name = require_len("name", &self.name.unwrap_or_default(), 1, 300)?;
        let item_type = self
            .item_type
            .filter(|t| ITEM_TYPES.contains(&t.as_str()))
            .ok_or_else(|| {
                fail(
                    "item_type",
                    format!("must be one of {}", ITEM_TYPES.join(", ")),
                )
            })?;
        if let Some(cs) = self.current_stock {
            require_nonneg("current_stock", cs)?;
        }
        let min_threshold = self
            .min_threshold
            .ok_or_else(|| fail("min_threshold", "is required"))?;
        require_nonneg("min_threshold", min_threshold)?;
        let average_cost = self
            .average_cost
            .ok_or_else(|| fail("average_cost", "is required"))?;
        require_nonneg("average_cost", average_cost)?;
        let unit_of_measure =
            require_len("unit_of_measure", &self.unit_of_measure.unwrap_or_default(), 1, 50)?;
        let issuing_unit =
            require_len("issuing_unit", &self.issuing_unit.unwrap_or_default(), 1, 50)?;
        Ok(ValidProduct {
            sku,
            name,
            item_type,
            current_stock: self.current_stock,
            min_threshold,
            average_cost,
            unit_of_measure,
            issuing_unit,
            supplier_id: opt_uuid("supplier_id", &self.supplier_id)?,
            bin_location_id: opt_uuid("bin_location_id", &self.bin_location_id)?,
        })
    }
}

// ============================================================================
// POST /api/v1/movements — createMovementBody in lib/api/schemas.ts
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateMovementBody {
    pub product_id: Option<String>,
    pub sku: Option<String>,
    pub r#type: Option<String>,
    pub quantity: Option<f64>,
    pub reason: Option<String>,
    pub scrap_image_url: Option<String>,
}

pub struct ValidMovement {
    pub product_id: Option<String>,
    pub sku: Option<String>,
    pub r#type: crate::auth::MovementType,
    pub quantity: f64,
    pub reason: Option<String>,
    pub scrap_image_url: Option<String>,
}

impl CreateMovementBody {
    pub fn validate(self) -> Result<ValidMovement, ApiError> {
        let mtype = self
            .r#type
            .and_then(|t| crate::auth::MovementType::parse(&t))
            .ok_or_else(|| {
                fail(
                    "type",
                    "must be one of inbound, outbound, adjustment, scrap, tool_checkout, receiving",
                )
            })?;
        let quantity = self
            .quantity
            .ok_or_else(|| fail("quantity", "is required"))?;
        if !quantity.is_finite() || quantity <= 0.0 {
            return Err(fail("quantity", "Quantity must be positive"));
        }
        let product_id = opt_uuid("product_id", &self.product_id)?;
        let sku = match &self.sku {
            None => None,
            Some(s) => Some(require_len("sku", s, 1, 100)?),
        };
        // .refine((v) => v.product_id || v.sku) in the Zod schema
        if product_id.is_none() && sku.is_none() {
            return Err(fail("(body)", "Provide product_id or sku"));
        }
        Ok(ValidMovement {
            product_id,
            sku,
            r#type: mtype,
            quantity,
            reason: opt_len("reason", &self.reason, 1000)?,
            scrap_image_url: opt_len("scrap_image_url", &self.scrap_image_url, 1000)?,
        })
    }
}

// ============================================================================
// Query params — productListQuery / movementListQuery in lib/api/schemas.ts.
// Parsed from RawQuery with serde_urlencoded, then ranged like z.coerce.
// ============================================================================

#[derive(Debug, Default, Deserialize)]
pub struct ProductListQuery {
    pub q: Option<String>,
    pub item_type: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl ProductListQuery {
    pub fn validate(self) -> Result<Self, ApiError> {
        if let Some(q) = &self.q {
            if q.trim().is_empty() || q.len() > 200 {
                return Err(fail("q", "must contain 1-200 character(s)"));
            }
        }
        if let Some(t) = &self.item_type {
            if !ITEM_TYPES.contains(&t.as_str()) {
                return Err(fail(
                    "item_type",
                    format!("must be one of {}", ITEM_TYPES.join(", ")),
                ));
            }
        }
        if let Some(l) = self.limit {
            if !(1..=500).contains(&l) {
                return Err(fail("limit", "must be between 1 and 500"));
            }
        }
        if let Some(o) = self.offset {
            if o < 0 {
                return Err(fail("offset", "must be >= 0"));
            }
        }
        Ok(self)
    }
}

#[derive(Debug, Default, Deserialize)]
pub struct MovementListQuery {
    pub product_id: Option<String>,
    pub days: Option<i64>,
    pub limit: Option<i64>,
}

impl MovementListQuery {
    pub fn validate(self) -> Result<Self, ApiError> {
        if let Some(p) = &self.product_id {
            if !is_uuid(p) {
                return Err(fail("product_id", "must be a valid uuid"));
            }
        }
        if let Some(d) = self.days {
            if !(1..=365).contains(&d) {
                return Err(fail("days", "must be between 1 and 365"));
            }
        }
        if let Some(l) = self.limit {
            if !(1..=200).contains(&l) {
                return Err(fail("limit", "must be between 1 and 200"));
            }
        }
        Ok(self)
    }
}
