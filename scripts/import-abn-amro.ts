/**
 * Fynn — ABN AMRO XLS Import Script
 *
 * Gebruik:
 *   $env:SEED_USER_ID="uuid"; $env:SEED_SESSION_COOKIE="sb-..."; npx tsx scripts/import-abn-amro.ts "C:\pad\naar\export.xls"
 */

import dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TARGET_USER_ID = process.env.SEED_USER_ID!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const SESSION_COOKIE = process.env.SEED_SESSION_COOKIE ?? ''

if (!TARGET_USER_ID || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Zet SEED_USER_ID, NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface AbnRow {
  accountNumber: string
  currency: string
  transactionDate: string
  valueDate: string
  startBalance: number
  endBalance: number
  amount: number
  description: string
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

function parseDate(raw: string): string {
  const s = raw.trim().replace('.0', '')
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
  const match = s.match(/^(\d{2})[-./](\d{2})[-./](\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return s
}

function parseAmount(raw: string): number {
  const s = raw.trim()
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  return parseFloat(s.replace(',', ''))
}

function detectColumnMap(headers: string[]) {
  const h = headers.map(s => s.toLowerCase().trim())
  // Formaat A: Rekeningnummer | Muntsoort | Transactiedatum | Rentedatum | Beginsaldo | Eindsaldo | Transactiebedrag | Omschrijving
  // Formaat B: Rekeningnummer | Muntsoort | Transactiedatum | Beginstand | Eindstand  | Rentedatum | Bedrag | Omschrijving
  const isFormatA = h[3] === 'rentedatum'
  return isFormatA
    ? { accountNumber: 0, currency: 1, transactionDate: 2, valueDate: 3, startBalance: 4, endBalance: 5, amount: 6, description: 7 }
    : { accountNumber: 0, currency: 1, transactionDate: 2, valueDate: 5, startBalance: 3, endBalance: 4, amount: 6, description: 7 }
}

function parseAbnXls(filePath: string): AbnRow[] {
  const buffer = fs.readFileSync(filePath)
  const isBinaryXls = buffer[0] === 0xD0 && buffer[1] === 0xCF
  const isXlsx = buffer[0] === 0x50 && buffer[1] === 0x4B

  let rawLines: string[][]

  if (isBinaryXls || isXlsx) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rawLines = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][]
    } catch {
      console.error('❌ Installeer: npm install xlsx')
      process.exit(1)
    }
  } else {
    const content = buffer.toString('utf-8').replace(/\r/g, '')
    rawLines = content.split('\n')
      .filter(l => l.trim().length > 0)
      .map(l => l.split('\t').map(c => c.trim().replace(/^"|"$/g, '')))
  }

  if (rawLines.length === 0) return []

  const firstRow = rawLines[0].map(s => s.toLowerCase().trim())
  const hasHeader = firstRow.includes('rekeningnummer') || firstRow.includes('accountnummer')
  const colMap = detectColumnMap(rawLines[0])
  const startIndex = hasHeader ? 1 : 0

  const rows: AbnRow[] = []
  for (let i = startIndex; i < rawLines.length; i++) {
    const cols = rawLines[i]
    if (!cols || cols.length < 8) continue
    const accountRaw = cols[colMap.accountNumber]?.trim().replace('.0', '')
    if (!accountRaw) continue
    const amount = parseAmount(cols[colMap.amount])
    if (isNaN(amount)) continue
    rows.push({
      accountNumber: accountRaw,
      currency: cols[colMap.currency]?.trim() || 'EUR',
      transactionDate: parseDate(cols[colMap.transactionDate]),
      valueDate: cols[colMap.valueDate]?.trim(),
      startBalance: parseAmount(cols[colMap.startBalance]),
      endBalance: parseAmount(cols[colMap.endBalance]),
      amount,
      description: cols[colMap.description]?.trim() || '',
    })
  }
  return rows
}

// ─── ACCOUNT TYPE DETECTIE ───────────────────────────────────────────────────
// Spaarrekening = heeft "direct sparen" of "creditrente" EN geen dagelijkse uitgaven (AH, Jumbo, etc.)

const DAILY_SPENDING_KEYWORDS = [
  'albert heijn', 'jumbo', 'lidl', 'aldi', 'bea,', 'apple pay',
  'pin ', 'mcdonalds', 'restaurant', 'cafe', 'tankstation', 'shell',
]

function detectAccountInfo(accountNumber: string, rows: AbnRow[]): {
  name: string
  type: 'SAVINGS' | 'CHECKING'
} {
  const descriptions = rows
    .filter(r => r.accountNumber === accountNumber)
    .map(r => r.description.toLowerCase())

  const hasDailySpending = descriptions.some(d =>
    DAILY_SPENDING_KEYWORDS.some(kw => d.includes(kw))
  )

  const hasSavingsSignal = descriptions.some(d =>
    d.includes('direct sparen') || d.includes('creditrente') ||
    d.includes('spaarrekening') || d.includes('deposito')
  )

  if (hasSavingsSignal && !hasDailySpending) {
    return { name: 'ABN AMRO Spaarrekening', type: 'SAVINGS' }
  }

  return { name: 'ABN AMRO Betaalrekening', type: 'CHECKING' }
}

// ─── API PIPELINE ─────────────────────────────────────────────────────────────

async function callApi(route: string): Promise<void> {
  if (!SESSION_COOKIE) {
    console.warn(`  ⚠️  SEED_SESSION_COOKIE niet ingesteld — ${route} overgeslagen`)
    return
  }
  try {
    const res = await fetch(`${APP_URL}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': SESSION_COOKIE },
    })
    const data = await res.json()
    if (!res.ok) console.warn(`  ⚠️  ${route} HTTP ${res.status}:`, data)
    else console.log(`  ✅ ${route}:`, JSON.stringify(data))
  } catch (e) {
    console.warn(`  ⚠️  ${route} mislukt:`, e)
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2]
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`❌ Bestand niet gevonden: ${filePath}`)
    process.exit(1)
  }

  console.log(`\n📂 Inladen: ${path.resolve(filePath)}\n`)

  const allRows = parseAbnXls(filePath)
  if (allRows.length === 0) {
    console.error('❌ Geen transacties gevonden.')
    process.exit(1)
  }

  const accountNumbers = [...new Set(allRows.map(r => r.accountNumber))]
  console.log(`✅ ${allRows.length} transacties over ${accountNumbers.length} rekening(en):\n`)
  accountNumbers.forEach(acc => {
    const { name, type } = detectAccountInfo(acc, allRows)
    const count = allRows.filter(r => r.accountNumber === acc).length
    console.log(`   ${name} (${acc}) — ${count} tx — type: ${type}`)
  })

  let totalInserted = 0

  for (const accountNumber of accountNumbers) {
    const rows = allRows.filter(r => r.accountNumber === accountNumber)
    const latestBalance = rows[rows.length - 1].endBalance
    const { name, type } = detectAccountInfo(accountNumber, allRows)

    console.log(`\n━━━ ${name} ━━━`)

    const { data: existingAccount } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', TARGET_USER_ID)
      .eq('external_id', accountNumber)
      .maybeSingle()

    let accountId: string

    if (existingAccount) {
      accountId = existingAccount.id
      await supabase.from('bank_accounts')
        .update({ balance: latestBalance, account_name: name, account_type: type, updated_at: new Date().toISOString() })
        .eq('id', accountId)
      console.log(`✅ Bijgewerkt — saldo: €${latestBalance}`)
    } else {
      const { data: newAccount, error } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: TARGET_USER_ID,
          institution_name: 'ABN AMRO',
          account_name: name,
          iban: accountNumber,
          currency: rows[0].currency || 'EUR',
          provider: 'manual_import',
          external_id: accountNumber,
          balance: latestBalance,
          account_type: type,
        })
        .select('id')
        .single()

      if (error || !newAccount) {
        console.error(`❌ Aanmaken mislukt:`, error?.message)
        continue
      }
      accountId = newAccount.id
      console.log(`✅ Aangemaakt — saldo: €${latestBalance}`)
    }

    // Transacties opslaan — category null, pipeline doet de rest
    const txRows = rows.map((row, i) => ({
      user_id: TARGET_USER_ID,
      account_id: accountId,
      amount: row.amount,
      currency: row.currency || 'EUR',
      description: row.description,
      category: null,
      transaction_date: row.transactionDate,
      provider: 'manual_import',
      external_id: `abn_${accountNumber}_${row.transactionDate}_${row.amount}_${i}`,
    }))

    let inserted = 0
    for (let i = 0; i < txRows.length; i += 100) {
      const chunk = txRows.slice(i, i + 100)
      const { data, error } = await supabase
        .from('transactions')
        .upsert(chunk, { onConflict: 'external_id', ignoreDuplicates: true })
        .select('id')
      if (error) console.warn(`  ⚠️  Batch ${i}: ${error.message}`)
      else inserted += data?.length || 0
    }
    console.log(`✅ ${inserted} transacties (${rows.length - inserted} al aanwezig)`)
    totalInserted += inserted
  }

  // Totaal saldo (alleen betaalrekeningen voor Decision Engine)
  const balances: Record<string, { balance: number; type: string; name: string }> = {}
  for (const acc of accountNumbers) {
    const rows = allRows.filter(r => r.accountNumber === acc)
    const { name, type } = detectAccountInfo(acc, allRows)
    balances[acc] = { balance: rows[rows.length - 1].endBalance, type, name }
  }

  const checkingBalance = Object.values(balances)
    .filter(a => a.type === 'CHECKING')
    .reduce((s, a) => s + a.balance, 0)

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 IMPORT KLAAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Transacties  : ${allRows.length} (${totalInserted} nieuw)
Rekeningen   :`)

  Object.values(balances).forEach(a => {
    console.log(`  ${a.name.padEnd(28)} €${a.balance.toFixed(2)} (${a.type})`)
  })
  console.log(`  ${'Decision Engine gebruikt'.padEnd(28)} €${checkingBalance.toFixed(2)} (alleen CHECKING)`)

  // ─── Post-import pipeline ─────────────────────────────────────────
  console.log(`\n🔄 Post-import pipeline...`)
  console.log(`  → /api/categorize`)
  await callApi('/api/categorize')
  console.log(`  → /api/recurring/detect`)
  await callApi('/api/recurring/detect')

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(console.error)