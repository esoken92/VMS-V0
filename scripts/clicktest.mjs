// clicktest.mjs — "does it actually work when you click it" audit.
//
//   node scripts/clicktest.mjs [baseUrl] [email] [password] [--worker]
//
// Logs in through the real form, then drives REAL write flows end-to-end:
// product create, inbound/outbound movements, stock take start+complete,
// tool checkout+return, storeroom create + toggle-render check, API key
// create, REST/PDF/MCP endpoint checks, empty-submit + double-click checks.
//
// Prints a PASS/FAIL line per check and a summary at the end. Exit code 1
// if any check failed. Screenshots land in public/screenshots/flow-*.png.

import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:3000'
const EMAIL = process.argv[3] || 'admin@vms-v0.local'
const PASSWORD = process.argv[4] || 'VmsAdmin123!'
const WORKER_MODE = process.argv.includes('--worker')
const OUT = fileURLToPath(new URL('../public/screenshots/', import.meta.url))
mkdirSync(OUT, { recursive: true })

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

const results = []
const consoleErrors = new Map() // page -> [errors]
let currentPage = 'boot'
const RUN = Date.now().toString(36).slice(-6)
const SKU = `CT-${RUN}`.toUpperCase()

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(page, name) {
  try {
    await page.screenshot({ path: `${OUT}flow-${name}.png` })
    console.log(`    📸 flow-${name}.png`)
  } catch (e) {
    console.log(`    📸 ${name} failed: ${e.message}`)
  }
}

/** Click first button/link whose text includes `text`. Optional CSS scope. */
const clickButtonByText = async (page, text, scope = null) =>
  page.evaluate(
    (t, sc) => {
      const root = sc ? document.querySelector(sc) : document
      if (!root) return false
      const btn = [...root.querySelectorAll('button, a')].find((b) =>
        (b.textContent || '').includes(t),
      )
      if (btn) {
        btn.click()
        return true
      }
      return false
    },
    text,
    scope,
  )

const buttonExists = async (page, text) =>
  page.evaluate((t) => {
    return [...document.querySelectorAll('button, a')].some((b) =>
      (b.textContent || '').includes(t),
    )
  }, text)

const pageHasText = async (page, text) =>
  page.evaluate((t) => document.body.innerText.includes(t), text)

const waitText = async (page, text, timeout = 8000) =>
  page
    .waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text)
    .then(() => true)
    .catch(() => false)

/** Wait for success text OR a red error banner; return which won. */
async function waitOutcome(page, successText, timeout = 15000) {
  const winner = await page
    .waitForFunction(
      (st) => {
        if (document.body.innerText.includes(st)) return 'success'
        const err = document.querySelector('[class*="bg-destructive/10"]')
        if (err && (err.textContent || '').trim()) return `error:${err.textContent.trim()}`
        return false
      },
      { timeout, polling: 300 },
      successText,
    )
    .then((h) => h.jsonValue())
    .catch(() => 'timeout')
  return winner
}

/** Click the submit button inside the last visible .fixed modal. */
const submitModal = async (page) =>
  page.evaluate(() => {
    const modals = [...document.querySelectorAll('.fixed.inset-0')]
    const modal = modals[modals.length - 1]
    const btn = modal && modal.querySelector('form button[type="submit"], form button:not([type])')
    if (btn) {
      btn.click()
      return true
    }
    // fallback: any visible submit button
    const any = [...document.querySelectorAll('button[type="submit"]')].pop()
    if (any) {
      any.click()
      return 'fallback'
    }
    return false
  })

/** Fill a labelled field inside the open modal (label text → sibling input). */
async function fillModalField(page, label, value) {
  const ok = await page.evaluate(
    (lbl, val) => {
      const modals = [...document.querySelectorAll('.fixed.inset-0')]
      const root = modals[modals.length - 1] || document
      const labels = [...root.querySelectorAll('label')]
      const lab = labels.find((l) => (l.textContent || '').trim().startsWith(lbl))
      if (!lab) return 'no-label'
      const field =
        lab.parentElement.querySelector('input, select, textarea') ||
        lab.nextElementSibling
      if (!field) return 'no-field'
      const proto = field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : field instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, val)
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
      return 'ok'
    },
    label,
    value,
  )
  if (ok !== 'ok') throw new Error(`fillModalField "${label}": ${ok}`)
}

/** Select a <select> option by visible text inside the open modal. */
async function selectModalOption(page, label, optionText) {
  const ok = await page.evaluate(
    (lbl, optText) => {
      const modals = [...document.querySelectorAll('.fixed.inset-0')]
      const root = modals[modals.length - 1] || document
      const lab = [...root.querySelectorAll('label')].find((l) =>
        (l.textContent || '').trim().startsWith(lbl),
      )
      const sel = lab?.parentElement.querySelector('select')
      if (!sel) return 'no-select'
      const opt = [...sel.options].find((o) => (o.textContent || '').includes(optText))
      if (!opt) return 'no-option'
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(
        sel,
        opt.value,
      )
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      return 'ok'
    },
    label,
    optionText,
  )
  if (ok !== 'ok') throw new Error(`selectModalOption "${label}" → "${optionText}": ${ok}`)
}

async function setField(page, selector, value) {
  await page.evaluate(
    (sel, val) => {
      const el = document.querySelector(sel)
      if (!el) throw new Error(`no element ${sel}`)
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    selector,
    value,
  )
}

async function goto(page, path, name) {
  currentPage = name || path
  if (!consoleErrors.has(currentPage)) consoleErrors.set(currentPage, [])
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(1400)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--disable-gpu', '--window-size=1440,900'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    if (!consoleErrors.has(currentPage)) consoleErrors.set(currentPage, [])
    consoleErrors.get(currentPage).push(msg.text())
  }
})
page.on('pageerror', (err) => {
  if (!consoleErrors.has(currentPage)) consoleErrors.set(currentPage, [])
  consoleErrors.get(currentPage).push(`pageerror: ${err.message}`)
})

// ---------- LOGIN ----------
await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle2', timeout: 60000 })
const emailSel = 'input#email'
const passSel = 'input#password'
await page.waitForSelector(emailSel, { timeout: 30000 })
let enabled = false
for (let attempt = 0; attempt < 6 && !enabled; attempt++) {
  await page.click(emailSel, { clickCount: 3 })
  await page.type(emailSel, EMAIL, { delay: 12 })
  await page.click(passSel, { clickCount: 3 })
  await page.type(passSel, PASSWORD, { delay: 12 })
  enabled = await page
    .waitForFunction(
      () => {
        const b = document.querySelector('button[type="submit"]')
        return b && !b.disabled
      },
      { timeout: 4000 },
    )
    .then(() => true)
    .catch(() => false)
}
await page.keyboard.press('Enter')
await page
  .waitForFunction(() => !location.pathname.includes('/auth/login'), { timeout: 30000 })
  .catch(() => null)
// Second pass: if typing raced hydration (fields wiped, Enter no-op) or the
// first submit flaked, do the full type→submit cycle one more time.
if (page.url().includes('/auth/login')) {
  console.log('    login retry…')
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.click(emailSel, { clickCount: 3 })
    await page.type(emailSel, EMAIL, { delay: 15 })
    await page.click(passSel, { clickCount: 3 })
    await page.type(passSel, PASSWORD, { delay: 15 })
    const okNow = await page
      .waitForFunction(
        () => {
          const b = document.querySelector('button[type="submit"]')
          return b && !b.disabled
        },
        { timeout: 4000 },
      )
      .then(() => true)
      .catch(() => false)
    if (okNow) break
  }
  await page.keyboard.press('Enter')
  await page
    .waitForFunction(() => !location.pathname.includes('/auth/login'), { timeout: 30000 })
    .catch(() => null)
  const errText = await page
    .$eval('[class*="bg-destructive/10"], .text-destructive', (el) => el.textContent)
    .catch(() => null)
  if (errText) console.log('    login error text:', errText)
}
await sleep(2000)
check('login: lands off /auth/login', !page.url().includes('/auth/login'), page.url())

if (WORKER_MODE) {
  // ================= WORKER-SCOPE CHECKS =================
  await goto(page, '/dashboard/inventory', 'worker-inventory')
  check(
    'worker: Add Product button hidden on inventory',
    !(await buttonExists(page, 'Add Product')),
  )
  await shot(page, 'worker-inventory')

  await goto(page, '/dashboard/stock-movements', 'worker-movements')
  // Staff CAN record inbound — but NOT outbound. Try outbound via the UI.
  await clickButtonByText(page, 'Outbound Issue')
  await sleep(600)
  await selectModalOption(page, 'Product', 'BRK-001')
  await fillModalField(page, 'Quantity', '1')
  await submitModal(page)
  const denied = await waitText(page, 'cannot record outbound', 10000)
  check('worker: outbound movement denied with clear error', denied)
  await shot(page, 'worker-outbound-denied')
  await clickButtonByText(page, 'Cancel')
  await sleep(400)

  // scrap must also be denied for staff
  await clickButtonByText(page, 'Scrap Movement')
  await sleep(600)
  await selectModalOption(page, 'Product', 'BRK-001')
  await fillModalField(page, 'Quantity', '1')
  await submitModal(page)
  const scrapDenied = await waitText(page, 'cannot record scrap', 10000)
  check('worker: scrap movement denied with clear error', scrapDenied)
  await clickButtonByText(page, 'Cancel')
  await sleep(400)

  // inbound SHOULD work for staff
  await clickButtonByText(page, 'Inbound Receipt')
  await sleep(600)
  await selectModalOption(page, 'Product', 'WD-40')
  await fillModalField(page, 'Quantity', '1')
  await fillModalField(page, 'Reason', 'worker inbound clicktest')
  await submitModal(page)
  const inOk = await waitText(page, 'movement recorded successfully', 12000)
  check('worker: inbound movement allowed (staff scope)', inOk)

  await goto(page, '/dashboard/settings', 'worker-settings')
  check(
    'worker: settings page denies access',
    await pageHasText(page, 'Access denied'),
  )
  await shot(page, 'worker-settings-denied')

  await goto(page, '/dashboard/rooms/new', 'worker-room-new')
  const roomDenied =
    (await pageHasText(page, 'manager or admin role')) ||
    (await pageHasText(page, 'Access denied'))
  check(
    'worker: room create page blocks staff',
    roomDenied,
    `url=${page.url()}`,
  )
  await shot(page, 'worker-room-denied')

  // tool loans: staff may self-checkout but the assign-to list has only self
  await goto(page, '/dashboard/tool-loans', 'worker-tool-loans')
  await clickButtonByText(page, 'Check Out Tool')
  await sleep(700)
  const assigneeCount = await page.evaluate(() => {
    const modals = [...document.querySelectorAll('.fixed.inset-0')]
    const modal = modals[modals.length - 1]
    const sels = modal ? [...modal.querySelectorAll('form select')] : []
    return sels[1] ? sels[1].options.length : -1
  })
  check(
    'worker: assign-to list is self-only (1 user option + placeholder)',
    assigneeCount === 2,
    `options=${assigneeCount}`,
  )
  await clickButtonByText(page, 'Cancel')

  // REST API as worker session — outbound must 403
  const workerCookies = await page.cookies()
  const cookieHeader = workerCookies.map((c) => `${c.name}=${c.value}`).join('; ')
  const r = await fetch(`${BASE}/api/v1/movements`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader },
    body: JSON.stringify({ sku: 'BRK-001', type: 'outbound', quantity: 1 }),
  })
  const rb = await r.json().catch(() => null)
  check(
    'worker: POST /api/v1/movements outbound → forbidden',
    r.status === 403 && !!rb?.error,
    `status=${r.status} body=${JSON.stringify(rb)?.slice(0, 140)}`,
  )
  const pdfRes = await fetch(`${BASE}/api/reports/inventory-valuation`, {
    headers: { cookie: cookieHeader },
  })
  check(
    'worker: GET /api/reports/inventory-valuation → denied (not PDF)',
    pdfRes.status === 401 || pdfRes.status === 403,
    `status=${pdfRes.status}`,
  )
} else {
  // ================= ADMIN FLOWS =================

  // ---- 1. PRODUCT CREATE ----
  await goto(page, '/dashboard/inventory', 'inventory')
  await shot(page, 'inventory-before')
  await clickButtonByText(page, 'Add Product')
  await sleep(600)

  // 1a. empty submit — native required validation should block (no 500, no success)
  await submitModal(page)
  await sleep(700)
  const stillModal = await page.evaluate(() => {
    const m = [...document.querySelectorAll('.fixed.inset-0')].pop()
    const sku = m?.querySelector('input[required]')
    return {
      modalOpen: !!m,
      invalid: sku ? !sku.checkValidity() && sku.validationMessage.length > 0 : null,
    }
  })
  check(
    'empty product submit → native inline validation, modal stays',
    stillModal.modalOpen && stillModal.invalid === true,
    JSON.stringify(stillModal),
  )
  await shot(page, 'product-empty-submit')

  // 1b. fill the form for real
  await fillModalField(page, 'SKU', SKU)
  await fillModalField(page, 'Name', 'ClickTest Widget')
  await fillModalField(page, 'Category', 'consumable') // select keeps default anyway
  await fillModalField(page, 'Current Stock', '25')
  await fillModalField(page, 'Min Threshold', '5')
  await fillModalField(page, 'Average Cost', '9.99')
  await fillModalField(page, 'Unit of Measure', 'Each')
  await fillModalField(page, 'Issuing Unit', 'Each')
  await submitModal(page)
  const prodOutcome = await waitOutcome(page, 'Product added successfully')
  check('product create → success message', prodOutcome === 'success', prodOutcome)
  await shot(page, 'product-created')

  // 1c. persistence after reload
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1200)
  await setField(page, 'input[placeholder*="Search"]', SKU)
  await sleep(800)
  const persisted = await pageHasText(page, 'ClickTest Widget')
  check('product persists after reload + search', persisted)
  await shot(page, 'product-persisted')

  // 1d. duplicate SKU submit → clean error, not 500/crash
  await clickButtonByText(page, 'Add Product')
  await sleep(600)
  await fillModalField(page, 'SKU', SKU)
  await fillModalField(page, 'Name', 'Dup SKU Widget')
  await fillModalField(page, 'Unit of Measure', 'Each')
  await fillModalField(page, 'Issuing Unit', 'Each')
  await submitModal(page)
  const dupErr = await page
    .waitForFunction(
      () => {
        const banner = document.querySelector('[class*="bg-destructive/10"]')
        if (banner && banner.textContent.trim()) return banner.textContent.trim()
        if (document.body.innerText.includes('already exists')) return 'duplicate rejected (text)'
        return false
      },
      { timeout: 20000, polling: 300 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null)
  const crashText = await pageHasText(page, 'Internal Server Error')
  check('duplicate SKU → inline error (no 500)', !!dupErr && !crashText, dupErr || 'no error shown')
  await shot(page, 'product-dup-sku')
  await clickButtonByText(page, 'Cancel')
  await sleep(400)

  // 1e. double-click submit → must not create duplicate products
  const SKU2 = `${SKU}B`
  await clickButtonByText(page, 'Add Product')
  await sleep(600)
  await fillModalField(page, 'SKU', SKU2)
  await fillModalField(page, 'Name', 'ClickTest Widget B')
  await fillModalField(page, 'Current Stock', '10')
  await fillModalField(page, 'Unit of Measure', 'Each')
  await fillModalField(page, 'Issuing Unit', 'Each')
  await page.evaluate(() => {
    const modals = [...document.querySelectorAll('.fixed.inset-0')]
    const btn = modals[modals.length - 1].querySelector('form button[type="submit"]')
    btn.click()
    btn.click()
  })
  await sleep(2500)
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1200)
  await setField(page, 'input[placeholder*="Search"]', SKU2)
  await sleep(800)
  const bCount = await page.evaluate(
    (sku) =>
      [...document.querySelectorAll('tbody tr')].filter((r) =>
        (r.textContent || '').includes(sku),
      ).length,
    SKU2,
  )
  check('double-click submit → exactly 1 row', bCount === 1, `rows=${bCount}`)
  await setField(page, 'input[placeholder*="Search"]', '')

  // ---- 2. STOCK MOVEMENTS ----
  await goto(page, '/dashboard/stock-movements', 'movements')

  // read current stock of our product via the product select label
  const readStock = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await clickButtonByText(page, 'Inbound Receipt')
      await sleep(900)
      const stock = await page.evaluate((sku) => {
        const opts = [...document.querySelectorAll('.fixed.inset-0 form select option')]
        const o = opts.find((x) => (x.textContent || '').includes(sku + ' '))
        const m = o && o.textContent.match(/Stock:\s*([\d.]+)/)
        return m ? Number(m[1]) : null
      }, SKU)
      await clickButtonByText(page, 'Cancel')
      await sleep(400)
      if (stock !== null) return stock
    }
    return null
  }

  const stockBefore = await readStock()
  check('movement modal lists new product w/ stock', stockBefore !== null, `stock=${stockBefore}`)

  // inbound +10
  await clickButtonByText(page, 'Inbound Receipt')
  await sleep(600)
  await selectModalOption(page, 'Product', SKU + ' ')
  await fillModalField(page, 'Quantity', '10')
  await fillModalField(page, 'Reason', 'clicktest inbound')
  await submitModal(page)
  const inOutcome = await waitOutcome(page, 'movement recorded successfully')
  check('inbound movement → success', inOutcome === 'success', inOutcome)
  await shot(page, 'movement-inbound')

  const stockAfterIn = await readStock()
  check(
    'inbound movement → stock +10',
    stockBefore !== null && stockAfterIn === stockBefore + 10,
    `before=${stockBefore} after=${stockAfterIn}`,
  )

  // outbound -4
  await clickButtonByText(page, 'Outbound Issue')
  await sleep(600)
  await selectModalOption(page, 'Product', SKU + ' ')
  await fillModalField(page, 'Quantity', '4')
  await fillModalField(page, 'Reason', 'clicktest outbound')
  await submitModal(page)
  const outOutcome = await waitOutcome(page, 'movement recorded successfully')
  check('outbound movement → success', outOutcome === 'success', outOutcome)

  const stockAfterOut = await readStock()
  check(
    'outbound movement → stock -4',
    stockAfterOut === stockBefore + 10 - 4,
    `after=${stockAfterOut} expected=${stockBefore + 6}`,
  )

  // movement rows appear in the table
  await setField(page, 'input[placeholder*="Search"]', SKU)
  await sleep(600)
  const rowsShow = await page.evaluate(
    (sku) =>
      [...document.querySelectorAll('tbody tr')].filter((r) =>
        (r.textContent || '').includes(sku),
      ).length,
    SKU,
  )
  check('movement rows visible in ledger table', rowsShow >= 2, `rows=${rowsShow}`)
  await shot(page, 'movements-after')
  await setField(page, 'input[placeholder*="Search"]', '')

  // double-click the movement submit — must produce exactly ONE ledger row
  await clickButtonByText(page, 'Inbound Receipt')
  await sleep(700)
  await selectModalOption(page, 'Product', SKU + ' ')
  await fillModalField(page, 'Quantity', '2')
  const dblReason = `dblclick-guard-${RUN}`
  await fillModalField(page, 'Reason', dblReason)
  await page.evaluate(() => {
    const modals = [...document.querySelectorAll('.fixed.inset-0')]
    const btn = modals[modals.length - 1].querySelector('form button[type="submit"]')
    btn.click()
    btn.click()
    btn.click()
  })
  const dblOutcome = await waitOutcome(page, 'movement recorded successfully')
  check('movement double-click → success once', dblOutcome === 'success', dblOutcome)
  await sleep(800)
  await setField(page, 'input[placeholder*="Search"]', dblReason)
  await sleep(600)
  const dblRows = await page.evaluate(
    (reason) =>
      [...document.querySelectorAll('tbody tr')].filter((r) =>
        (r.textContent || '').includes(reason),
      ).length,
    dblReason,
  )
  check('movement double-click → exactly 1 ledger row', dblRows === 1, `rows=${dblRows}`)
  const stockAfterDbl = await readStock()
  check(
    'movement double-click → stock +2 once',
    stockAfterDbl === stockBefore + 6 + 2,
    `stock=${stockAfterDbl} expected=${stockBefore + 8}`,
  )
  await setField(page, 'input[placeholder*="Search"]', '')

  // ---- 3. STOCK TAKE ----
  await goto(page, '/dashboard/stock-takes', 'stock-takes')
  await clickButtonByText(page, 'Start New Stock Take')
  const stOutcome = await waitOutcome(page, 'Stock take started successfully')
  check('stock take start → success', stOutcome === 'success', stOutcome)
  await sleep(600)

  // Continue the newest open take (first "Continue" button in table)
  const continued = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('tbody tr button')].find((b) =>
      (b.textContent || '').includes('Continue'),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  })
  check(
    'stock take → counting mode opens',
    continued && (await waitText(page, 'Stock Take in Progress', 6000)),
  )
  await sleep(800)
  await shot(page, 'stocktake-counting')

  // Set counts on first two product rows: system-2 and system+1
  const countInfo = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.space-y-2 > div')].filter((d) =>
      d.querySelector('input[type="number"]'),
    )
    const setNative = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const out = []
    if (rows[0]) {
      const sys = Number((rows[0].textContent.match(/System:\s*([\d.]+)/) || [])[1])
      setNative(rows[0].querySelector('input'), String(sys - 2))
      out.push({ sys, phys: sys - 2 })
    }
    if (rows[1]) {
      const sys = Number((rows[1].textContent.match(/System:\s*([\d.]+)/) || [])[1])
      setNative(rows[1].querySelector('input'), String(sys + 1))
      out.push({ sys, phys: sys + 1 })
    }
    return out
  })
  const expectedVariance = countInfo.reduce((a, c) => a + (c.phys - c.sys), 0)
  check('stock take → counted 2 products', countInfo.length === 2, JSON.stringify(countInfo))

  await clickButtonByText(page, 'Complete Stock Take')
  const stDone = await waitOutcome(page, 'Stock take completed successfully', 30000)
  check('stock take complete → success', stDone === 'success', stDone)
  await shot(page, 'stocktake-completed')
  writeFileSync(
    fileURLToPath(new URL('../.clicktest-state.json', import.meta.url)),
    JSON.stringify({ sku: SKU, sku2: SKU2, expectedVariance, run: RUN }),
  )

  // ---- 4. TOOL LOANS ----
  await goto(page, '/dashboard/tool-loans', 'tool-loans')
  const activeBefore = await page.evaluate(
    () => document.body.innerText.match(/Active Tool Loans \((\d+)\)/)?.[1],
  )
  // TL-007 Ratchet has no seeded loan — safe to check out
  await clickButtonByText(page, 'Check Out Tool')
  await sleep(700)
  await selectModalOption(page, 'Tool', 'TL-007')
  // Assign To → first real user (options[0] is the placeholder)
  await page.evaluate(() => {
    const modals = [...document.querySelectorAll('.fixed.inset-0')]
    const sel = modals[modals.length - 1].querySelectorAll('form select')[1]
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(
      sel,
      sel.options[1].value,
    )
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await fillModalField(page, 'Notes', 'clicktest checkout')
  await submitModal(page)
  const coOutcome = await waitOutcome(page, 'checked out successfully')
  check('tool checkout → success', coOutcome === 'success', coOutcome)
  await sleep(600)
  const activeAfter = await page.evaluate(
    () => document.body.innerText.match(/Active Tool Loans \((\d+)\)/)?.[1],
  )
  check(
    'tool checkout → active loan count +1',
    Number(activeAfter) === Number(activeBefore) + 1,
    `${activeBefore}→${activeAfter}`,
  )
  await shot(page, 'toolloan-checked-out')

  // return the TL-007 loan
  const returned = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) =>
      (r.textContent || '').includes('TL-007'),
    )
    const btn = row && [...row.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Return'),
    )
    if (btn) {
      btn.click()
      return true
    }
    return false
  })
  await sleep(700)
  if (returned) {
    await submitModal(page)
    const retOutcome = await waitOutcome(page, 'returned successfully')
    check('tool return → success', retOutcome === 'success', retOutcome)
    await sleep(600)
    const stillActive = await page.evaluate(() =>
      [...document.querySelectorAll('tbody tr')].some(
        (r) =>
          (r.textContent || '').includes('TL-007') &&
          (r.textContent || '').includes('Active'),
      ),
    )
    check('tool return → loan no longer active', !stillActive)
  } else {
    check('tool return → found Return button', false, 'no Return button on TL-007 row')
  }
  await shot(page, 'toolloan-returned')

  // ---- 5. STOREROOM + TOGGLE RENDERING ----
  await goto(page, '/dashboard/rooms/new', 'room-new')
  await sleep(600)
  // measure every switch: must be ~44x24 pill, not stretched
  const switchGeo = await page.evaluate(() => {
    return [...document.querySelectorAll('button[role="switch"]')].map((b) => {
      const r = b.getBoundingClientRect()
      const thumb = b.querySelector('span')?.getBoundingClientRect()
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        tw: thumb ? Math.round(thumb.width) : 0,
        th: thumb ? Math.round(thumb.height) : 0,
        checked: b.getAttribute('aria-checked'),
      }
    })
  })
  const allPills =
    switchGeo.length > 0 &&
    switchGeo.every(
      (s) => s.w === 44 && s.h === 24 && s.tw === 20 && s.th === 20,
    )
  check(
    'room feature switches render as 44×24 pills',
    allPills,
    JSON.stringify(switchGeo.slice(0, 4)),
  )
  await shot(page, 'room-toggles-initial')

  // flip first switch on, verify aria-checked + visual change, screenshot, flip back
  await page.evaluate(() => document.querySelectorAll('button[role="switch"]')[0].click())
  await sleep(400)
  const ariaOn = await page.evaluate(
    () => document.querySelectorAll('button[role="switch"]')[0].getAttribute('aria-checked'),
  )
  await shot(page, 'room-toggle-on')
  await page.evaluate(() => document.querySelectorAll('button[role="switch"]')[0].click())
  await sleep(400)
  const ariaOff = await page.evaluate(
    () => document.querySelectorAll('button[role="switch"]')[0].getAttribute('aria-checked'),
  )
  await shot(page, 'room-toggle-off')
  check('toggle click flips aria-checked', ariaOn === 'true' && ariaOff === 'false', `${ariaOn}/${ariaOff}`)

  await setField(page, 'input[placeholder*="Cold Store"]', `ClickTest Room ${RUN}`)
  await clickButtonByText(page, 'Create room')
  await page
    .waitForFunction(
      () =>
        location.pathname.match(/^\/dashboard\/rooms\/[0-9a-f-]{36}$/),
      { timeout: 40000, polling: 500 },
    )
    .catch(() => null)
  await sleep(800)
  const onRoomDetail = page.url().match(/\/dashboard\/rooms\/[0-9a-f-]{36}/) !== null
  const roomErr = await page.evaluate(() => {
    const banner = document.querySelector('[class*="bg-destructive/10"]')
    return banner ? banner.textContent.trim() : null
  })
  check('storeroom create → redirects to room detail', onRoomDetail, page.url() + (roomErr ? ` err=${roomErr}` : ''))
  await shot(page, 'room-detail')
  await goto(page, '/dashboard/rooms', 'rooms')
  check('storeroom appears in list', await pageHasText(page, `ClickTest Room ${RUN}`))
  await shot(page, 'rooms-list')

  // ---- 6. API KEY + REST ----
  await goto(page, '/dashboard/integrations', 'integrations')
  await clickButtonByText(page, 'Create Key')
  await sleep(700)
  await fillModalField(page, 'Name', `clicktest-${RUN}`)
  // add write scope
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')]
    const write = boxes.find((b) =>
      b.closest('label')?.textContent?.toLowerCase().startsWith('write'),
    )
    if (write && !write.checked) write.click()
  })
  await submitModal(page)
  const keyShown = await waitText(page, 'copy it now', 10000)
  check('API key create → key shown once', keyShown)
  const apiKey = await page.evaluate(
    () => document.querySelector('code.font-mono')?.textContent?.trim() || null,
  )
  check(
    'API key → vms_ prefix captured',
    !!apiKey && apiKey.startsWith('vms_'),
    apiKey ? apiKey.slice(0, 12) + '…' : 'none',
  )
  await shot(page, 'apikey-created')

  const adminCookies = await page.cookies()
  const adminCookieHeader = adminCookies.map((c) => `${c.name}=${c.value}`).join('; ')

  if (apiKey) {
    const stockRes = await fetch(`${BASE}/api/v1/stock`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const ct = stockRes.headers.get('content-type') || ''
    const stockBody = await stockRes.json().catch(() => null)
    check(
      'GET /api/v1/stock with key → JSON array',
      stockRes.status === 200 && ct.includes('json') && !!stockBody?.data,
      `status=${stockRes.status} ct=${ct} rows=${stockBody?.data?.length}`,
    )

    const mcpRes = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    })
    const mcpBody = await mcpRes.json().catch(() => null)
    check(
      'POST /api/mcp initialize → JSON-RPC result',
      mcpRes.status === 200 &&
        mcpBody?.jsonrpc === '2.0' &&
        mcpBody?.id === 1 &&
        !!mcpBody?.result,
      `status=${mcpRes.status} body=${JSON.stringify(mcpBody)?.slice(0, 160)}`,
    )

    const toolsRes = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    })
    const toolsBody = await toolsRes.json().catch(() => null)
    check(
      'POST /api/mcp tools/list → tools array',
      Array.isArray(toolsBody?.result?.tools),
      `tools=${toolsBody?.result?.tools?.length}`,
    )
  }

  // ---- 7. PDF REPORT (session cookie) ----
  const pdfRes = await fetch(`${BASE}/api/reports/inventory-valuation`, {
    headers: { cookie: adminCookieHeader },
  })
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer())
  check(
    'GET /api/reports/inventory-valuation → %PDF bytes',
    pdfRes.status === 200 && pdfBuf.subarray(0, 4).toString() === '%PDF',
    `status=${pdfRes.status} magic=${pdfBuf.subarray(0, 4).toString()} bytes=${pdfBuf.length}`,
  )
  if (pdfBuf.subarray(0, 4).toString() === '%PDF') {
    writeFileSync(
      fileURLToPath(new URL('../public/screenshots/flow-inventory-valuation.pdf', import.meta.url)),
      pdfBuf,
    )
  }

  // ---- 8. settings toggles (second switch style) ----
  await goto(page, '/dashboard/settings', 'settings')
  const settingsSwitchGeo = await page.evaluate(() => {
    return [...document.querySelectorAll('input.sr-only.peer')].map((i) => {
      const pill = i.nextElementSibling?.getBoundingClientRect()
      return pill ? { w: Math.round(pill.width), h: Math.round(pill.height) } : null
    })
  })
  const settingsPills =
    settingsSwitchGeo.length > 0 &&
    settingsSwitchGeo.every((s) => s && s.w === 44 && s.h === 24)
  check('settings toggles render as 44×24 pills', settingsPills, JSON.stringify(settingsSwitchGeo))
  await shot(page, 'settings-toggles')
}

// ---------- console error report ----------
console.log('\n--- console errors by page ---')
let anyConsoleErrors = false
for (const [pg, errs] of consoleErrors) {
  if (errs.length) {
    anyConsoleErrors = true
    console.log(`${pg}: ${errs.length} error(s)`)
    for (const e of [...new Set(errs)].slice(0, 5)) console.log(`   ${e.slice(0, 200)}`)
  }
}
if (!anyConsoleErrors) console.log('(none)')

// ---------- summary ----------
const fails = results.filter((r) => !r.ok)
console.log(`\n=== ${results.length - fails.length}/${results.length} checks passed ===`)
if (fails.length) {
  console.log('FAILED:')
  for (const f of fails) console.log(`  - ${f.name}: ${f.detail}`)
}
await browser.close()
process.exit(fails.length ? 1 : 0)
