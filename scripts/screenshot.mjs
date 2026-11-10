// Screenshot pipeline — logs in via the real form, captures app pages to public/screenshots/
// Usage: node scripts/screenshot.mjs [baseUrl] [email] [password]
// Requires puppeteer-core + a system Edge/Chrome (no download needed).
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:3000'
const EMAIL = process.argv[3] || 'demo.admin@vms-demo.com'
const PASSWORD = process.argv[4] || 'DemoAdmin123!'
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
await page.waitForFunction(() => !location.pathname.includes('/auth/login'), { timeout: 45000 }).catch(() => null)
await new Promise((r) => setTimeout(r, 2500))
console.log('post-login URL:', page.url())
const errText = await page.$eval('.text-red-700, .text-red-800', (el) => el.textContent).catch(() => null)
if (errText) console.log('login error text:', errText)

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
    await new Promise((r) => setTimeout(r, 1200)) // charts/motion settle
    await page.screenshot({ path: `${OUT}${PREFIX}${name}.png` })
    console.log(`✓ ${PREFIX}${name}.png <- ${page.url()}`)
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`)
  }
}
await browser.close()
console.log('done')
