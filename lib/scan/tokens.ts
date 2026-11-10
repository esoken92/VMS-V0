/**
 * lib/scan/tokens — HMAC-signed label tokens.
 *
 * Wire format:  vms.v1.{type}.{id}.{iat}.{exp}.{sig}
 *   type   product|bin|take|tool
 *   id     entity uuid
 *   iat    issued-at, unix seconds
 *   exp    expiry, unix seconds
 *   sig    base64url(HMAC-SHA256(secret, "vms.v1.{type}.{id}.{iat}.{exp}"))
 *
 * Secret: env LABEL_SIGNING_SECRET (>= 16 chars recommended). A constant
 * dev fallback is compiled in so a fresh checkout keeps working — it is
 * logged loudly on first use and MUST be overridden in production
 * (docs/.env.example documents the variable).
 *
 * Replay/anomaly strategy (kept deliberately simple for the demo):
 *   - Verification checks signature + iat/exp bounds.
 *   - The label_tokens table is the nonce cache: a presented token must
 *     exist there (i.e. WE issued it) and have consumed_at IS NULL.
 *   - Reprinting a label rotates the token — older prints stop scanning.
 *   - Impossible-velocity and rate anomalies are flagged on scan_events
 *     (see engine.ts), not rejected, so staff see the anomaly trail.
 */

import { createHmac, createHash, timingSafeEqual } from 'crypto';
import type { ScanEntityType } from '@/drizzle/scan-schema';
import { SCAN_ENTITY_TYPES } from '@/drizzle/scan-schema';
import { LABEL_TOKEN_PREFIX } from './codes';

const DEV_FALLBACK_SECRET = 'vms-dev-label-secret-not-for-production';
/** Default label lifetime: 180 days. Override with LABEL_TTL_SECONDS. */
const DEFAULT_TTL_SECONDS = 180 * 24 * 60 * 60;
/** Accept a tiny amount of clock skew on the issuer vs the scanner. */
const CLOCK_SKEW_SECONDS = 60;

let warnedAboutFallback = false;

function signingSecret(): string {
  const secret = process.env.LABEL_SIGNING_SECRET;
  if (secret && secret.length >= 8) return secret;
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      '[scan] LABEL_SIGNING_SECRET is not set — using the built-in dev ' +
        'fallback. Set LABEL_SIGNING_SECRET in production!',
    );
  }
  return DEV_FALLBACK_SECRET;
}

export function labelTtlSeconds(): number {
  const raw = Number(process.env.LABEL_TTL_SECONDS);
  return Number.isFinite(raw) && raw >= 60 ? Math.floor(raw) : DEFAULT_TTL_SECONDS;
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret())
    .update(payload, 'utf8')
    .digest('base64url');
}

export interface SignedLabel {
  token: string;
  /** sha256 hex of the full token — the label_tokens PK. */
  tokenHash: string;
  iat: Date;
  exp: Date;
}

/** Mint a token. Caller persists {tokenHash, iat, exp} to label_tokens. */
export function signLabelToken(
  type: ScanEntityType,
  id: string,
  now = new Date(),
): SignedLabel {
  const iatSec = Math.floor(now.getTime() / 1000);
  const expSec = iatSec + labelTtlSeconds();
  const payload = `${LABEL_TOKEN_PREFIX}${type}.${id}.${iatSec}.${expSec}`;
  const token = `${payload}.${sign(payload)}`;
  return {
    token,
    tokenHash: createHash('sha256').update(token, 'utf8').digest('hex'),
    iat: new Date(iatSec * 1000),
    exp: new Date(expSec * 1000),
  };
}

export type VerifyResult =
  | { ok: true; type: ScanEntityType; id: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

const TOKEN_RE =
  /^vms\.v1\.([a-z]+)\.([0-9a-fA-F-]{36})\.(\d{1,12})\.(\d{1,12})\.([A-Za-z0-9_-]{10,200})$/;

/** Verify format + signature + time bounds of a presented token. */
export function verifyLabelToken(token: string, now = new Date()): VerifyResult {
  const m = TOKEN_RE.exec(token);
  if (!m) return { ok: false, reason: 'malformed' };

  const type = m[1] as ScanEntityType;
  if (!(SCAN_ENTITY_TYPES as readonly string[]).includes(type)) {
    return { ok: false, reason: 'malformed' };
  }
  const id = m[2];
  const iatSec = Number(m[3]);
  const expSec = Number(m[4]);
  const presentedSig = m[5];

  const payload = token.slice(0, token.lastIndexOf('.'));
  const expected = sign(payload);
  const a = Buffer.from(presentedSig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const nowSec = Math.floor(now.getTime() / 1000);
  if (expSec <= nowSec) return { ok: false, reason: 'expired' };
  // iat in the future beyond skew → treat as malformed/forged.
  if (iatSec > nowSec + CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'malformed' };
  }

  return { ok: true, type, id };
}

/** sha256 hex — key for the label_tokens nonce lookup. */
export function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
