// Generates PNG/ICO brand assets from app/icon.svg + an OG share card.
// Usage: node scripts/gen-brand-assets.mjs   (requires puppeteer-core + Chrome)
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const ICON_SVG = readFileSync("app/icon.svg", "utf8");

const OG_HTML = `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;background:#f9f8f4;display:flex;flex-direction:column;justify-content:space-between;padding:72px;font-family:'Segoe UI',system-ui,sans-serif;box-sizing:border-box">
  <div style="display:flex;align-items:center;gap:20px">
    ${ICON_SVG.replace("<svg", '<svg width="88" height="88"')}
    <span style="font-size:34px;font-weight:700;color:#17130f;letter-spacing:-0.5px">VMS V0</span>
    <span style="font-size:15px;font-weight:600;color:#1d4ed8;border:1.5px solid #1d4ed8;border-radius:999px;padding:5px 14px">open source</span>
  </div>
  <div>
    <div style="font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px">Inventory management · self-hosted</div>
    <div style="font-size:56px;font-weight:700;line-height:1.12;letter-spacing:-1.5px;color:#17130f;max-width:980px">Inventory that respects the people doing the work.</div>
    <div style="font-size:22px;color:#4a4038;margin-top:20px;max-width:820px;line-height:1.45">Typed storerooms, scan-first workflows, an append-only ledger, RBAC and a REST + MCP API. Next.js 16 + Postgres.</div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:17px;color:#8a7f72;font-weight:600">
    <span>github.com/esoken92/VMS-V0</span><span>free · self-hosted · no telemetry</span>
  </div>
</div></body></html>`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
});

async function rasterizeSvg(svg, size) {
  // Canvas-produced PNGs are RGBA — required for the ICO wrapper.
  const page = await browser.newPage();
  const dataUrl =
    "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  const b64 = await page.evaluate(
    async (src, s) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = s;
      c.height = s;
      c.getContext("2d").drawImage(img, 0, 0, s, s);
      return c.toDataURL("image/png");
    },
    dataUrl,
    size,
  );
  return Buffer.from(b64.split(",")[1], "base64");
}

function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

mkdirSync("public/icons", { recursive: true });

writeFileSync("app/favicon.ico", pngToIco(await rasterizeSvg(ICON_SVG, 32), 32));
writeFileSync("app/apple-icon.png", await rasterizeSvg(ICON_SVG, 180));
writeFileSync("public/icons/icon-192x192.png", await rasterizeSvg(ICON_SVG, 192));
writeFileSync("public/icons/icon-512x512.png", await rasterizeSvg(ICON_SVG, 512));

const og = await browser.newPage();
await og.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await og.setContent(OG_HTML);
writeFileSync("app/opengraph-image.png", await og.screenshot({ type: "png" }));

await browser.close();
console.log("Wrote favicon.ico, apple-icon.png, opengraph-image.png, icons/{192,512}.png");
