/**
 * lib/pdf/compiler — in-process Typst → PDF compilation (no Chromium).
 *
 * One lazily-created NodeCompiler per process; each render is a one-shot
 * pdf() call followed by evictCache() so the compiler's internal cache
 * can't grow unbounded inside a warm serverless function.
 *
 * Fonts: the four Inter TTFs in ./fonts are read with literal per-file
 * readFileSync calls — file-tracing can only follow static paths, never a
 * directory glob, which is what ships them into every traced function
 * (see outputFileTracingIncludes in next.config.js).
 */

import { join, resolve, sep } from 'node:path';
import { readFileSync } from 'node:fs';
import type { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';

let cachedCompiler: NodeCompiler | null = null;

const fontBlobs = () => [
  readFileSync(join(process.cwd(), 'lib/pdf/fonts/Inter-400.ttf')),
  readFileSync(join(process.cwd(), 'lib/pdf/fonts/Inter-500.ttf')),
  readFileSync(join(process.cwd(), 'lib/pdf/fonts/Inter-600.ttf')),
  readFileSync(join(process.cwd(), 'lib/pdf/fonts/Inter-700.ttf')),
];

async function getCompiler(): Promise<NodeCompiler> {
  if (cachedCompiler) return cachedCompiler;
  const { NodeCompiler } = await import(
    '@myriaddreamin/typst-ts-node-compiler'
  );
  cachedCompiler = NodeCompiler.create({
    workspace: '.',
    fontArgs: [{ fontBlobs: fontBlobs() }],
  });
  return cachedCompiler;
}

export type TypstAsset = { path: string; bytes: Buffer };

/**
 * Shadow-file keys must be the absolute workspace-resolved path the typst
 * source resolves to — `image("assets/logo.png")` under workspace "." looks
 * up `<cwd>/assets/logo.png`. Windows separators are normalised to forward
 * slashes so keys match on every platform.
 */
const shadowKey = (p: string): string => resolve(p).split(sep).join('/');

/**
 * Compile a Typst source string to PDF bytes.
 * - `inputs` land in typst as `sys.inputs` (values must be strings —
 *   JSON-encode objects).
 * - `assets` are binary files mapped into the compiler's shadow FS;
 *   reference them from typst as `image("assets/<name>")`.
 */
export async function renderTypstPdf(opts: {
  source: string;
  inputs?: Record<string, string>;
  assets?: TypstAsset[];
}): Promise<Buffer> {
  const compiler = await getCompiler();
  try {
    for (const a of opts.assets ?? []) {
      compiler.mapShadow(shadowKey(a.path), a.bytes);
    }
    const bytes = compiler.pdf({
      mainFileContent: opts.source,
      inputs: opts.inputs ?? {},
    });
    return Buffer.from(bytes);
  } finally {
    for (const a of opts.assets ?? []) {
      try {
        compiler.unmapShadow(shadowKey(a.path));
      } catch {
        // shadow entry may not exist if compile failed early — safe to ignore
      }
    }
    try {
      compiler.evictCache(10);
    } catch {
      // best-effort cache hygiene
    }
  }
}
