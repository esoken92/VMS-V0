// Screenshot pipeline — logs in via the real form, captures app pages to public/screenshots/
// Usage: node scripts/screenshot.mjs [baseUrl] [email] [password]
// Requires puppeteer-core + a system Edge/Chrome (no download needed).
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:3000'
const EMAIL = process.argv[3] || 'admin@vms-v0.local'
const PASSWORD = process.argv[4] || 'VmsAdmin123!'
const PREFIX = process.argv[5] || '' // e.g. 'worker-' to capture a second persona without overwriting
const OUT = fileURLToPath(new URL('../public/screenshots/', import.meta.url))

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]
const executablePath = EDGE_CANDIDATES.find((p) => existsSync(p))
if (!executablePath) {
  console.error('No Edge/Chrome found')
  process.exit(1)
}

const SHOTS = [
  ['dashboard', '/dashboard'],
  ['inventory', '/dashboard/inventory'],
  ['scan', '/dashboard/scan'],
  ['rooms', '/dashboard/rooms'],
  ['monitoring', '/dashboard/monitoring'],
  ['stock-takes', '/dashboard/stock-takes'],
  ['tool-loans', '/dashboard/tool-loans'],
  ['zone-map', '/dashboard/zone-map'],
  ['ledger', '/dashboard/ledger'],
  ['integrations', '/dashboard/integrations'],
  ['reports', '/dashboard/reports'],
]

mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--disable-gpu', '--window-size=1440,900'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
// Pin light theme — headless Chrome inherits the OS color scheme, so
// marketing pages (which honor prefers-color-scheme) would otherwise
// capture dark while most visitors see light.
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
await page.evaluateOnNewDocument(() => {
  try { localStorage.setItem('vms-theme', 'light') } catch { /* noop */ }
})

// Public pages first — landing + the login form itself.
for (const [name, path] of [['landing', '/'], ['login', '/auth/login']]) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await new Promise((r) => setTimeout(r, 1500))
    await page.screenshot({ path: `${OUT}${name}.png` })
    console.log(`✓ ${name}.png <- ${page.url()}`)
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`)
  }
}

// Login via the real form
// Login via Auth.js REST endpoints — deterministic; the form's submit
// button is gated on useSession() resolving, which can stall while dev
// compiles in the background, and typing races hydration anyway.
await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
const loginResult = await page.evaluate(async (email, password) => {
  const { csrfToken } = await fetch('/api/auth/csrf').then((r) => r.json())
  const res = await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: '/dashboard' }),
    redirect: 'manual',
  })
  const session = await fetch('/api/auth/session').then((r) => r.json())
  return { status: res.status || res.type, user: session?.user?.email ?? null }
}, EMAIL, PASSWORD)
console.log('login:', loginResult.user ? `authenticated as ${loginResult.user}` : `FAILED (${loginResult.status})`)
await new Promise((r) => setTimeout(r, 1000))

// Give the monitoring page real telemetry: click "Seed 24h history" once.
const clickButtonByText = async (text) => {
  const clicked = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t))
    if (btn) { btn.click(); return true }
    return false
  }, text)
  return clicked
}

for (const [name, path] of SHOTS) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 45000 })
    if (name === 'monitoring' && (await clickButtonByText('Seed 24h history'))) {
      await new Promise((r) => setTimeout(r, 4000)) // readings + charts populate
      await page.reload({ waitUntil: 'networkidle2' }).catch(() => null)
    }
    // Wait for client data fetches to settle — "Loading …" placeholders
    // should be gone before capture (up to 15s, then shoot anyway).
    await page
      .waitForFunction(
        () => !document.body.innerText.match(/Loading [a-z ]+\.\.\./i),
        { timeout: 15000 },
      )
      .catch(() => null)
    await new Promise((r) => setTimeout(r, 1200)) // charts/motion settle
    await page.screenshot({ path: `${OUT}${PREFIX}${name}.png` })
    console.log(`✓ ${PREFIX}${name}.png <- ${page.url()}`)
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`)
  }
}
await browser.close()
console.log('done')
