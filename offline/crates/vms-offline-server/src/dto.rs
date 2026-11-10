//! Wire DTOs — field names mirror lib/types.ts + lib/api/data.ts exactly so
//! the same frontend / MCP clients work against either backend unchanged.

use serde::Serialize;

/// ApiProductDTO (data.ts): ProductDTO + joined bin-location labels.
#[derive(Debug, Serialize)]
pub struct ProductDto {
    pub id: String,
    pub sku: String,
    pub name: String,
    pub item_type: String,
    pub current_stock: f64,
    pub min_threshold: f64,
    pub average_cost: f64,
    pub unit_of_measure: String,
    pub issuing_unit: String,
    pub bin_location_id: Option<String>,
    pub supplier_id: Option<String>,
    pub weight_per_unit_kg: f64,
    pub carries_core_charge: bool,
    pub core_charge_amount: f64,
    pub last_movement_date: Option<String>,
    pub zone: Option<String>,
    pub bin_location: Option<String>,
}

/// StockMovementDTO (lib/types.ts).
#[derive(Debug, Serialize)]
pub struct StockMovementDto {
    pub id: String,
    pub product_id: String,
    pub product_sku: Option<String>,
    pub product_name: Option<String>,
    pub product_unit: Option<String>,
    pub user_id: String,
    pub user_name: Option<String>,
    pub r#type: String,
    pub quantity: f64,
    pub reason: Option<String>,
    pub scrap_image_url: Option<String>,
    pub created_at: Option<String>,
}

/// apiCreateMovement's return shape.
#[derive(Debug, Serialize)]
pub struct MovementCreatedDto {
    pub movement_id: String,
    pub new_stock: f64,
}

/// BinLocationDTO (lib/types.ts).
#[derive(Debug, Serialize)]
pub struct BinLocationDto {
    pub id: String,
    pub zone: String,
    pub bin_location: String,
    pub max_weight_kg: f64,
    pub description: Option<String>,
}

/// StoreroomListResult (data.ts apiListStorerooms) — the offline build always
/// has the table, so `implemented` is always true here.
#[derive(Debug, Serialize)]
pub struct StoreroomListDto {
    pub implemented: bool,
    pub storerooms: Vec<StoreroomDto>,
}

#[derive(Debug, Serialize)]
pub struct StoreroomDto {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub parent_id: Option<String>,
    pub access_level: String,
    pub active: bool,
}

/// Login response payload (offline extension route — see auth.rs).
#[derive(Debug, Serialize)]
pub struct LoginResponseDto {
    pub token: String,
    pub profile: LoginProfileDto,
}

#[derive(Debug, Serialize)]
pub struct LoginProfileDto {
    pub id: String,
    pub email: String,
    pub full_name: String,
    pub role: String,
}
