/**
 * lib/pdf/label — printable QR labels carrying signed tokens.
 *
 * A label embeds a vms.v1.{type}.{id}.{iat}.{exp}.{sig} token (see
 * lib/scan/tokens.ts) as a QR code plus a human-readable fallback line —
 * the same typed code a user can key in if the QR won't scan.
 *
 * Serving a label ISSUES a fresh token and consumes the entity's previous
 * one (label_tokens row rotation): a photographed or leaked label stops
 * working as soon as a replacement is printed. Duplicates must be printed
 * from the same fetched SVG, not by re-hitting the endpoint.
 *
 * Rendering: `qrcode.toString(token, { type: 'svg' })` gives us a pure-SVG
 * QR — no canvas, no image pipeline — which we nest inside a print-friendly
 * 60×40mm label layout. No new heavy deps.
 */

import QRCode from 'qrcode';
import type { ScanEntityType } from '@/drizzle/scan-schema';
import { buildTypedCode } from '@/lib/scan/codes';
import { signLabelToken, type SignedLabel } from '@/lib/scan/tokens';

export interface LabelSpec {
  /** Bold headline on the label (e.g. SKU or zone-bin). */
  title: string;
  /** Secondary line (e.g. product name). */
  subtitle?: string | null;
}

/** Issue (sign) a token for the entity — caller persists the nonce row. */
export function issueLabel(
  type: ScanEntityType,
  entityId: string,
): SignedLabel & { fallbackCode: string } {
  const signed = signLabelToken(type, entityId);
  return { ...signed, fallbackCode: buildTypedCode(type, entityId) };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compose a 60×40 mm SVG label: QR left, text right, fallback code along
 * the bottom. White background + crispEdges = reliable thermal printing.
 */
export async function buildLabelSvg(
  token: string,
  fallbackCode: string,
  spec: LabelSpec,
): Promise<string> {
  const qrSvg = await QRCode.toString(token, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
  });
  // Extract viewBox + inner content so we can nest it positioned+scaled.
  const viewBox = /viewBox="([^"]+)"/.exec(qrSvg)?.[1] ?? '0 0 33 33';
  const inner = qrSvg.replace(/^[^>]*>/, '').replace(/<\/svg>\s*$/, '');

  const title = escapeXml(spec.title);
  const subtitle = spec.subtitle ? escapeXml(spec.subtitle.slice(0, 40)) : null;
  const fallback = escapeXml(fallbackCode);

  // 600×400 units ≈ 60×40 mm at 10 units/mm.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="40mm" viewBox="0 0 600 400" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
  <rect width="600" height="400" fill="#ffffff"/>
  <rect x="4" y="4" width="592" height="392" fill="none" stroke="#d4d4d4" stroke-width="2" stroke-dasharray="8 6"/>
  <svg x="20" y="20" width="240" height="240" viewBox="${viewBox}" shape-rendering="crispEdges">${inner}</svg>
  <text x="285" y="78" font-size="42" font-weight="bold" fill="#111111">${title}</text>
  ${subtitle ? `<text x="285" y="124" font-size="24" fill="#444444">${subtitle}</text>` : ''}
  <text x="285" y="180" font-size="20" fill="#666666">VMS label — scan or type code</text>
  <text x="285" y="206" font-size="20" fill="#666666">${fallback}</text>
  <text x="300" y="330" font-size="18" fill="#888888" text-anchor="middle">vms.v1 signed label · reprint invalidates older labels</text>
</svg>`;
}
