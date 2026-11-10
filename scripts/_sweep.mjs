// Layout-sweep pipeline — logs in via the real form, captures pages the main
// screenshot set doesn't cover, to playtest-output/sweep/.
// Also records per-page: HTTP status, final URL (redirects), console errors,
// and pageerrors (uncaught exceptions).
// Usage: node scripts/_sweep.mjs [baseUrl] [email] [password]
// Requires puppeteer-core + a system Edge/Chrome (no download needed).
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:3000'
const EMAIL = process.argv[3] || 'demo.admin@vms-demo.com'
const PASSWORD = process.argv[4] || 'DemoAdmin123!'
const OUT = fileURLToPath(new URL('../playtest-output/sweep/', import.meta.url))

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

const PUBLIC_SHOTS = [
  ['signup', '/auth/signup'],
  ['forgot-password', '/auth/forgot-password'],
  ['scan-public', '/scan'],
]

const AUTH_SHOTS = [
  ['settings', '/dashboard/settings'],
  ['users', '/dashboard/users'],
  ['suppliers', '/dashboard/suppliers'],
  ['bin-locations', '/dashboard/bin-locations'],
  ['stock-movements', '/dashboard/stock-movements'],
  ['audit-log', '/dashboard/audit-log'],
  ['profile', '/dashboard/profile'],
  ['impersonate', '/dashboard/impersonate'],
  ['setup', '/dashboard/setup'],
  ['forbidden', '/dashboard/forbidden'],
]

mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--disable-gpu', '--window-size=1440,900'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

// Collect console errors + uncaught page errors. Cleared before each nav.
let consoleErrors = []
let pageErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => {
  pageErrors.push(err.message)
})

const report = []

async function capture(name, path) {
  consoleErrors = []
  pageErrors = []
  let status = null
  try {
    const resp = await page.goto(`${BASE}${path}`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    })
    status = resp ? resp.status() : null
    await new Promise((r) => setTimeout(r, 1500)) // settle client render
    await page.screenshot({ path: `${OUT}${name}.png` })
    const finalUrl = page.url()
    report.push({
      name,
      path,
      status,
      finalUrl,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
    })
    console.log(`✓ ${name}.png <- ${finalUrl} [${status}]`)
  } catch (e) {
    report.push({
      name,
      path,
      status,
      finalUrl: page.url(),
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      navError: e.message,
    })
    console.log(`✗ ${name}: ${e.message}`)
  }
}

// ---- Public pages (pre-login) ----
for (const [name, path] of PUBLIC_SHOTS) {
  await capture(name, path)
}

// ---- Login via the real form (same pattern as screenshot.mjs) ----
await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle2', timeout: 60000 })
const emailSel = 'input[type="email"], input[name="email"], input#email'
const passSel = 'input[type="password"], input[name="password"], input#password'
await page.waitForSelector(emailSel, { timeout: 30000 })
// Typing can race React hydration — controlled inputs get wiped on hydrate,
// leaving the form empty and the submit disabled forever. Type, then verify
// the value stuck; retry until it does.
let enabled = false
for (let attempt = 0; attempt < 6 && !enabled; attempt++) {
  await page.click(emailSel, { clickCount: 3 })
  await page.type(emailSel, EMAIL, { delay: 15 })
  await page.click(passSel, { clickCount: 3 })
  await page.type(passSel, PASSWORD, { delay: 15 })
  enabled = await page
    .waitForFunction(() => {
      const b = document.querySelector('button[type="submit"]')
      return b && !b.disabled
    }, { timeout: 4000 })
    .then(() => true)
    .catch(() => false)
  if (!enabled) console.log(`login attempt ${attempt + 1}: form not enabled — retrying`)
}
if (!enabled) console.log('WARN: submit button never enabled')
await page.keyboard.press('Enter') // native form submit — works when button enabled
await page
  .waitForFunction(() => !location.pathname.includes('/auth/login'), { timeout: 45000 })
  .catch(() => null)
await new Promise((r) => setTimeout(r, 2500))
console.log('post-login URL:', page.url())
const errText = await page.$eval('.text-red-700, .text-red-800', (el) => el.textContent).catch(() => null)
if (errText) console.log('login error text:', errText)

// ---- Authenticated pages ----
for (const [name, path] of AUTH_SHOTS) {
  await capture(name, path)
}

await browser.close()
writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 2))
console.log(`\nreport written to ${OUT}report.json`)
console.log('done')
