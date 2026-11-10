/**
 * lib/scan/codes — scan input normalization + code parsing.
 *
 * Accepted wire formats (checked in order):
 *   1. Signed label token   vms.v1.{type}.{id}.{iat}.{exp}.{sig}
 *      (parsed in lib/scan/tokens.ts — detected here by prefix only)
 *   2. Typed code           {TYPE}:{ID}[:{CHECK}]
 *      TYPE ∈ product|products|sku | bin|loc | take|session | tool|asset
 *      CHECK = first 4 hex chars of sha256("vms-code|{type}|{ID-upper}")
 *      — optional; rejected when present-but-wrong.
 *   3. Bare code            raw SKU / bin code / uuid — resolved by lookup.
 *
 * Normalization contract (applied before anything else):
 *   - strip ASCII + C1 control chars (wedge scanners leak \x00 etc.)
 *   - trim whitespace, cap at 128 chars
 *   - case-normalize ONLY the lookup key — signed tokens are case-sensitive
 *     and are matched verbatim.
 */

import { createHash } from 'crypto';
import type { ScanEntityType } from '@/drizzle/scan-schema';

export const MAX_SCAN_LENGTH = 128;
export const LABEL_TOKEN_PREFIX = 'vms.v1.';

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/** Sanitize a raw scanned payload. Never throws. */
export function normalizeScanInput(raw: string): string {
  return raw.replace(CONTROL_CHARS, '').trim().slice(0, MAX_SCAN_LENGTH);
}

/** sha256 hex — the only form of scan input we persist. */
export function hashScanInput(normalized: string): string {
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function isLabelToken(normalized: string): boolean {
  return normalized.startsWith(LABEL_TOKEN_PREFIX);
}

const TYPE_ALIASES: Record<string, ScanEntityType> = {
  product: 'product',
  products: 'product',
  sku: 'product',
  bin: 'bin',
  loc: 'bin',
  take: 'take',
  session: 'take',
  stocktake: 'take',
  tool: 'tool',
  asset: 'tool',
};

export interface ParsedCode {
  /** Canonical entity type from the prefix, or null for bare codes. */
  entityType: ScanEntityType | null;
  /** ID segment exactly as scanned (lookup happens case-insensitively). */
  id: string;
  /** True when a CHECK segment was present AND valid / when omitted. */
  checkOk: boolean;
}

/** Compute the 4-char check segment for a typed code. */
export function codeChecksum(type: ScanEntityType, id: string): string {
  return createHash('sha256')
    .update(`vms-code|${type}|${id.toUpperCase()}`, 'utf8')
    .digest('hex')
    .slice(0, 4);
}

/** Build a canonical typed code string (with checksum) for labels/docs. */
export function buildTypedCode(type: ScanEntityType, id: string): string {
  return `${type}:${id}:${codeChecksum(type, id)}`;
}

// {TYPE}:{ID}[:{CHECK}] — ID allows typical SKU/bin/asset alphabets.
const TYPED_CODE_RE = /^([A-Za-z]+):([A-Za-z0-9._/-]{1,100})(?::([0-9A-Fa-f]{4}))?$/;

/**
 * Parse a normalized input as a typed code. Returns null when the input
 * isn't `TYPE:ID` shaped at all (then callers fall back to bare lookup).
 */
export function parseTypedCode(normalized: string): ParsedCode | null {
  const m = TYPED_CODE_RE.exec(normalized);
  if (!m) return null;
  const type = TYPE_ALIASES[m[1].toLowerCase()];
  if (!type) return null;
  const id = m[2];
  const check = m[3];
  const checkOk = check === undefined || check === codeChecksum(type, id);
  return { entityType: type, id, checkOk };
}

export const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
