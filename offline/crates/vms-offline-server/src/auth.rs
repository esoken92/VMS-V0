//! Offline auth — local profiles + argon2id verify + bearer sessions.
//!
//! Ports `lib/auth/roles.ts` and `lib/auth/permissions.ts` faithfully: same
//! 5-role enum, same permission matrix, same movement-type matrix. There is
//! no RLS in SQLite — authorization lives here in the handler layer, exactly
//! like the web app's `can()` / `canCreateMovement()` checks
//! (spec item 303).
//!
//! Credential model vs the web artifact: the web accepts Auth.js session
//! cookies or `Bearer vms_…` scoped API keys (lib/api/auth.ts). Offline has
//! ONE credential type — a `Bearer vms_off_…` session token issued by
//! POST /api/v1/auth/login. API keys and impersonation are not part of the
//! offline surface (see docs/OFFLINE-APP.md parity matrix).

use argon2::{
    password_hash::{phc::PasswordHash, PasswordHasher, PasswordVerifier},
    Argon2,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::ApiError;

// ============================================================================
// Roles — USER_ROLES in lib/auth/roles.ts
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    SuperAdmin,
    Manager,
    Admin,
    FleetDispatch,
    Staff,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SuperAdmin => "super_admin",
            Self::Manager => "manager",
            Self::Admin => "admin",
            Self::FleetDispatch => "fleet_dispatch",
            Self::Staff => "staff",
        }
    }

    /// isUserRole() — unknown labels are rejected, never defaulted.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "super_admin" => Some(Self::SuperAdmin),
            "manager" => Some(Self::Manager),
            "admin" => Some(Self::Admin),
            "fleet_dispatch" => Some(Self::FleetDispatch),
            "staff" => Some(Self::Staff),
            _ => None,
        }
    }
}

// ============================================================================
// Item + movement types — ITEM_TYPES / MOVEMENT_TYPES in lib/auth/roles.ts
// ============================================================================

pub const ITEM_TYPES: [&str; 4] = ["consumable", "fluid", "tool", "tire"];

/// Movement types a caller may record via POST /api/v1/movements.
/// System legs (transfer/kit_consume/kit_produce) exist in the enum space
/// but are never accepted here — same as the web's createMovementBody.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MovementType {
    Inbound,
    Outbound,
    Adjustment,
    Scrap,
    ToolCheckout,
    Receiving,
}

impl MovementType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Inbound => "inbound",
            Self::Outbound => "outbound",
            Self::Adjustment => "adjustment",
            Self::Scrap => "scrap",
            Self::ToolCheckout => "tool_checkout",
            Self::Receiving => "receiving",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "inbound" => Some(Self::Inbound),
            "outbound" => Some(Self::Outbound),
            "adjustment" => Some(Self::Adjustment),
            "scrap" => Some(Self::Scrap),
            "tool_checkout" => Some(Self::ToolCheckout),
            "receiving" => Some(Self::Receiving),
            _ => None,
        }
    }

    /// Signing rule from apiCreateMovement (lib/api/data.ts):
    /// inbound/receiving/adjustment add; outbound/scrap/tool_checkout subtract.
    pub fn signed_quantity(self, quantity: f64) -> f64 {
        match self {
            Self::Inbound | Self::Receiving | Self::Adjustment => quantity.abs(),
            Self::Outbound | Self::Scrap | Self::ToolCheckout => -quantity.abs(),
        }
    }
}

// ============================================================================
// Permissions — Permission union + PERMISSION_MATRIX in lib/auth/permissions.ts
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Permission {
    ProductsRead,
    ProductsWrite,
    ProductsDelete,
    SuppliersRead,
    SuppliersWrite,
    SuppliersDelete,
    BinLocationsRead,
    BinLocationsWrite,
    UnitConversionsRead,
    UnitConversionsWrite,
    ProfilesReadAll,
    ProfilesWriteAny,
    ToolLoansReadAll,
    ToolLoansCreate,
    ToolLoansCreateForOther,
    ToolLoansReturnAny,
    ReceivingRead,
    ReceivingWrite,
    StockMovementsReadAll,
    StockTakesRead,
    StockTakesWrite,
    ActivityLogsRead,
    SystemSettingsRead,
    SystemSettingsWrite,
    UsersRead,
    UsersCreate,
    UsersUpdate,
    UsersDelete,
    UsersGrantSuperAdmin,
    ImpersonationUse,
    ReportsRead,
    TransfersRead,
    TransfersCreate,
    TransfersDispatch,
    TransfersReceive,
    TransfersCancel,
    KitsRead,
    KitsWrite,
    KitsAssemble,
}

use Permission::*;

// NOTE on structure: the web builds each role list as `...BASE_READ, extras`.
// Rust const slices can't be spread, so every list below repeats the 9
// BASE_READ entries first (ProductsRead, SuppliersRead, BinLocationsRead,
// UnitConversionsRead, StockTakesRead, ActivityLogsRead, ReceivingRead,
// TransfersRead, KitsRead), then the role's extras — same final sets.

const ADMIN_PERMS: &[Permission] = &[
    ProductsRead,
    SuppliersRead,
    BinLocationsRead,
    UnitConversionsRead,
    StockTakesRead,
    ActivityLogsRead,
    ReceivingRead,
    TransfersRead,
    KitsRead,
    ProductsWrite,
    ProductsDelete,
    SuppliersWrite,
    SuppliersDelete,
    BinLocationsWrite,
    UnitConversionsWrite,
    ProfilesReadAll,
    ProfilesWriteAny,
    ToolLoansReadAll,
    ToolLoansCreate,
    ToolLoansCreateForOther,
    ToolLoansReturnAny,
    ReceivingWrite,
    StockMovementsReadAll,
    StockTakesWrite,
    UsersRead,
    UsersCreate,
    UsersUpdate,
    ReportsRead,
    TransfersCreate,
    TransfersDispatch,
    TransfersReceive,
    TransfersCancel,
    KitsWrite,
    KitsAssemble,
];

const SUPER_ADMIN_PERMS: &[Permission] = &[
    ProductsRead,
    SuppliersRead,
    BinLocationsRead,
    UnitConversionsRead,
    StockTakesRead,
    ActivityLogsRead,
    ReceivingRead,
    TransfersRead,
    KitsRead,
    ProductsWrite,
    ProductsDelete,
    SuppliersWrite,
    SuppliersDelete,
    BinLocationsWrite,
    UnitConversionsWrite,
    ProfilesReadAll,
    ProfilesWriteAny,
    ToolLoansReadAll,
    ToolLoansCreate,
    ToolLoansCreateForOther,
    ToolLoansReturnAny,
    ReceivingWrite,
    StockMovementsReadAll,
    StockTakesWrite,
    UsersRead,
    UsersCreate,
    UsersUpdate,
    ReportsRead,
    TransfersCreate,
    TransfersDispatch,
    TransfersReceive,
    TransfersCancel,
    KitsWrite,
    KitsAssemble,
    SystemSettingsRead,
    SystemSettingsWrite,
    UsersDelete,
    UsersGrantSuperAdmin,
    ImpersonationUse,
];

const MANAGER_PERMS: &[Permission] = &[
    ProductsRead,
    SuppliersRead,
    BinLocationsRead,
    UnitConversionsRead,
    StockTakesRead,
    ActivityLogsRead,
    ReceivingRead,
    TransfersRead,
    KitsRead,
    ProductsWrite, // add/edit but NOT delete (006_add_manager_role)
    SuppliersWrite,
    ToolLoansReadAll,
    ToolLoansCreate,
    ToolLoansCreateForOther,
    ToolLoansReturnAny,
    ReceivingWrite,
    StockMovementsReadAll,
    StockTakesWrite,
    TransfersCreate,
    TransfersDispatch,
    TransfersReceive,
    TransfersCancel,
    KitsWrite,
    KitsAssemble,
];

const FLEET_DISPATCH_PERMS: &[Permission] = &[
    ProductsRead,
    SuppliersRead,
    BinLocationsRead,
    UnitConversionsRead,
    StockTakesRead,
    ActivityLogsRead,
    ReceivingRead,
    TransfersRead,
    KitsRead,
    ToolLoansReadAll,
    ToolLoansCreate,
    ToolLoansCreateForOther,
];

const STAFF_PERMS: &[Permission] = &[
    ProductsRead,
    SuppliersRead,
    BinLocationsRead,
    UnitConversionsRead,
    StockTakesRead,
    ActivityLogsRead,
    ReceivingRead,
    TransfersRead,
    KitsRead,
    ToolLoansCreate, // self-checkout only (no :for_other)
    ReceivingWrite,
    StockTakesWrite,
    TransfersCreate, // requestor — a manager/admin dispatches it
];

/// can() — the same check the web server actions run before any DB work.
pub fn can(role: Role, permission: Permission) -> bool {
    let perms: &[Permission] = match role {
        Role::SuperAdmin => SUPER_ADMIN_PERMS,
        Role::Admin => ADMIN_PERMS,
        Role::Manager => MANAGER_PERMS,
        Role::FleetDispatch => FLEET_DISPATCH_PERMS,
        Role::Staff => STAFF_PERMS,
    };
    perms.contains(&permission)
}

/// canCreateMovement() — MOVEMENT_TYPE_MATRIX port.
pub fn can_create_movement(role: Role, mtype: MovementType) -> bool {
    const ALL: &[MovementType] = &[
        MovementType::Inbound,
        MovementType::Outbound,
        MovementType::Adjustment,
        MovementType::Scrap,
        MovementType::ToolCheckout,
        MovementType::Receiving,
    ];
    let allowed: &[MovementType] = match role {
        Role::SuperAdmin | Role::Admin | Role::Manager => ALL,
        Role::FleetDispatch => &[MovementType::Outbound, MovementType::ToolCheckout],
        Role::Staff => &[
            MovementType::Inbound,
            MovementType::Adjustment,
            MovementType::Receiving,
        ],
    };
    allowed.contains(&mtype)
}

// ============================================================================
// Principal — ApiPrincipal in lib/api/auth.ts, minus API-key fields
// ============================================================================

#[derive(Debug, Clone)]
pub struct Principal {
    pub profile_id: String,
    pub role: Role,
    pub full_name: String,
}

impl Principal {
    /// requirePerm() in lib/api/data.ts.
    pub fn require(&self, permission: Permission) -> Result<(), ApiError> {
        if can(self.role, permission) {
            Ok(())
        } else {
            Err(ApiError::forbidden(format!(
                "Role '{}' lacks permission '{:?}'",
                self.role.as_str(),
                permission
            )))
        }
    }
}

// ============================================================================
// Argon2id + sessions
// ============================================================================

/// Verify `password` against a PHC argon2id hash string. Same PHC format as
/// the `argon2` npm package (Argon2id v=19), so hashes created by
/// scripts/seed.ts verify identically here.
pub fn verify_password(hash: &str, password: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// Hash a password with argon2id defaults (auto-generated random salt) —
/// used by --seed and (later) the first-boot wizard (spec item 304).
pub fn hash_password(password: &str) -> Result<String, ApiError> {
    Argon2::default()
        .hash_password(password.as_bytes())
        .map(|h| h.to_string())
        .map_err(|e| ApiError::internal(format!("password hashing failed: {e}")))
}

/// POST /api/v1/auth/login — verify credentials, mint a bearer token.
///
/// The web artifact has no REST login (Auth.js owns the form flow); this
/// route is an offline extension, documented as such. Failure deliberately
/// returns one 401 message for both bad email and bad password.
pub fn login(conn: &Connection, email: &str, password: &str) -> Result<LoginResult, ApiError> {
    let email = email.to_lowercase();
    let email = email.trim();
    let row: Option<(String, String, String, Option<String>)> = conn
        .query_row(
            "SELECT id, role, full_name, password_hash FROM profiles WHERE email = ?1",
            params![email],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()?;

    let Some((profile_id, role_str, full_name, hash)) = row else {
        return Err(ApiError::unauthenticated("Invalid email or password"));
    };
    let Some(hash) = hash else {
        return Err(ApiError::unauthenticated("Invalid email or password"));
    };
    if !verify_password(&hash, password) {
        return Err(ApiError::unauthenticated("Invalid email or password"));
    }
    let role = Role::parse(&role_str)
        .ok_or_else(|| ApiError::internal(format!("profile has unknown role '{role_str}'")))?;

    let token = format!("vms_off_{}", Uuid::new_v4().simple());
    conn.execute(
        "INSERT INTO sessions (token, profile_id, created_at) VALUES (?1, ?2, ?3)",
        params![token, profile_id, crate::now_iso()],
    )?;

    Ok(LoginResult {
        token,
        profile_id,
        role,
        full_name,
        email: email.to_string(),
    })
}

#[derive(Debug, Serialize)]
pub struct LoginResult {
    pub token: String,
    pub profile_id: String,
    pub role: Role,
    pub full_name: String,
    pub email: String,
}

/// Resolve `Authorization: Bearer <token>` to a Principal via the sessions
/// table. Equivalent of resolveApiPrincipal() for the session path.
pub fn resolve_bearer(conn: &Connection, header: Option<&str>) -> Result<Principal, ApiError> {
    let Some(header) = header else {
        return Err(ApiError::unauthenticated(
            "Provide an Authorization: Bearer vms_off_… session token from POST /api/v1/auth/login",
        ));
    };
    // /^Bearer\s+(.+)$/i — same acceptance shape as resolveApiPrincipal.
    let header = header.trim();
    let malformed = || ApiError::unauthenticated("Malformed Authorization header");
    let rest = header
        .get(6..)
        .filter(|_| header[..6].eq_ignore_ascii_case("bearer"))
        .ok_or_else(malformed)?;
    if !rest.starts_with(char::is_whitespace) {
        return Err(malformed());
    }
    let token = rest.trim_start();
    if token.is_empty() {
        return Err(malformed());
    }

    let row: Option<(String, String, String)> = conn
        .query_row(
            "SELECT p.id, p.role, p.full_name
               FROM sessions s JOIN profiles p ON p.id = s.profile_id
              WHERE s.token = ?1",
            params![token],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;

    let Some((profile_id, role_str, full_name)) = row else {
        return Err(ApiError::unauthenticated("Invalid or expired session token"));
    };
    let role = Role::parse(&role_str)
        .ok_or_else(|| ApiError::internal(format!("profile has unknown role '{role_str}'")))?;
    Ok(Principal {
        profile_id,
        role,
        full_name,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn movement_signing_rules() {
        // Mirrors apiCreateMovement: inbound/receiving/adjustment positive;
        // outbound/scrap/tool_checkout negative — even for negative input.
        assert_eq!(MovementType::Inbound.signed_quantity(5.0), 5.0);
        assert_eq!(MovementType::Receiving.signed_quantity(5.0), 5.0);
        assert_eq!(MovementType::Adjustment.signed_quantity(-5.0), 5.0);
        assert_eq!(MovementType::Outbound.signed_quantity(5.0), -5.0);
        assert_eq!(MovementType::Scrap.signed_quantity(-5.0), -5.0);
        assert_eq!(MovementType::ToolCheckout.signed_quantity(3.0), -3.0);
    }

    #[test]
    fn movement_matrix_matches_web() {
        for m in [
            MovementType::Inbound,
            MovementType::Outbound,
            MovementType::Adjustment,
            MovementType::Scrap,
            MovementType::ToolCheckout,
            MovementType::Receiving,
        ] {
            assert!(can_create_movement(Role::SuperAdmin, m));
            assert!(can_create_movement(Role::Admin, m));
            assert!(can_create_movement(Role::Manager, m));
        }
        assert!(can_create_movement(Role::FleetDispatch, MovementType::Outbound));
        assert!(can_create_movement(Role::FleetDispatch, MovementType::ToolCheckout));
        assert!(!can_create_movement(Role::FleetDispatch, MovementType::Inbound));
        assert!(!can_create_movement(Role::FleetDispatch, MovementType::Receiving));
        assert!(can_create_movement(Role::Staff, MovementType::Inbound));
        assert!(can_create_movement(Role::Staff, MovementType::Receiving));
        assert!(can_create_movement(Role::Staff, MovementType::Adjustment));
        assert!(!can_create_movement(Role::Staff, MovementType::Outbound));
        assert!(!can_create_movement(Role::Staff, MovementType::Scrap));
    }

    #[test]
    fn permission_matrix_spot_checks() {
        assert!(can(Role::Manager, Permission::ProductsWrite));
        assert!(!can(Role::Manager, Permission::ProductsDelete));
        assert!(!can(Role::Manager, Permission::BinLocationsWrite));
        assert!(can(Role::Staff, Permission::ProductsRead));
        assert!(!can(Role::Staff, Permission::StockMovementsReadAll));
        assert!(can(Role::Admin, Permission::StockMovementsReadAll));
        assert!(!can(Role::Admin, Permission::ImpersonationUse));
        assert!(can(Role::SuperAdmin, Permission::ImpersonationUse));
        assert!(can(Role::FleetDispatch, Permission::ToolLoansCreateForOther));
        assert!(!can(Role::Staff, Permission::ToolLoansCreateForOther));
    }

    #[test]
    fn argon2id_round_trip() {
        let hash = hash_password("VmsAdmin123!").unwrap();
        assert!(hash.starts_with("$argon2id$"));
        assert!(verify_password(&hash, "VmsAdmin123!"));
        assert!(!verify_password(&hash, "wrong"));
    }
}
