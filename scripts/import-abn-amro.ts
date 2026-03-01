/**
 * Fynn — ABN AMRO XLS Import Script
 *
 * Gebruik:
 *   1. Download transacties via ABN AMRO internetbankieren → Exporteren → Microsoft Excel
 *   2. Zet env variabelen in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   3. Run: SEED_USER_ID=jouw-uuid npx tsx scripts/import-abn-amro.ts "C:\pad\naar\export.xls"
 *
 * ABN AMRO kolomvolgorde (geen header):
 *   Rekeningnummer | Muntsoort | Transactiedatum | Beginstand | Eindstand | Rentedatum | Bedrag | Omschrijving
 */

import dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { categorizeTransaction } from '../src/lib/categorize-engine'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TARGET_USER_ID = process.env.SEED_USER_ID!

if (!TARGET_USER_ID) {
  console.error('❌ Zet SEED_USER_ID in je environment.')
  console.error('   Gebruik: SEED_USER_ID=uuid npx tsx scripts/import-abn-amro.ts export.xls')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface AbnRow {
  accountNumber: string
  currency: string
  transactionDate: string   // YYYY-MM-DD
  startBalance: number
  endBalance: number
  valueDate: string
  amount: number
  description: string
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

function parseDate(raw: string): string {
  const s = raw.trim()
  // YYYYMMDD
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
  // DD-MM-YYYY of DD.MM.YYYY of DD/MM/YYYY
  const match = s.match(/^(\d{2})[-./](\d{2})[-./](\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  // Al YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return s
}

function parseAmount(raw: string): number {
  const s = raw.trim()
  // "1.234,56" → NL formaat
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    return parseFloat(s.replace('.', '').replace(',', '.'))
  }
  return parseFloat(s.replace(',', ''))
}

function parseAbnXls(filePath: string): AbnRow[] {
  const buffer = fs.readFileSync(filePath)

  const isBinaryXls = buffer[0] === 0xD0 && buffer[1] === 0xCF  // OLE2
  const isXlsx = buffer[0] === 0x50 && buffer[1] === 0x4B        // ZIP/xlsx

  let lines: string[]

  if (isBinaryXls || isXlsx) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const raw: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })
      lines = raw
        .filter((row: string[]) => row.length >= 8)
        .map((row: string[]) => row.join('\t'))
    } catch {
      console.error('❌ Kon XLS niet lezen. Installeer: npm install xlsx')
      process.exit(1)
    }
  } else {
    // ABN's "nep" XLS — gewoon tab-separated tekst
    const content = buffer.toString('utf-8').replace(/\r/g, '')
    lines = content.split('\n').filter(l => l.trim().length > 0)
  }

  const rows: AbnRow[] = []

  for (const line of lines) {
    const cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 8) continue
    if (/rekeningnummer|accountnummer|datum/i.test(cols[0])) continue

    const amount = parseAmount(cols[6])
    if (isNaN(amount)) continue

    rows.push({
      accountNumber: cols[0],
      currency: cols[1] || 'EUR',
      transactionDate: parseDate(cols[2]),
      startBalance: parseAmount(cols[3]),
      endBalance: parseAmount(cols[4]),
      valueDate: cols[5],
      amount,
      description: cols[7] || '',
    })
  }

  return rows
}

// ─── RECURRING ITEMS DETECTIE ────────────────────────────────────────────────

function detectRecurring(rows: AbnRow[]) {
  const groups = new Map<string, AbnRow[]>()

  for (const row of rows) {
    if (row.amount >= 0) continue
    const key = row.description
      .toLowerCase()
      .replace(/\d{6,}/g, '#')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  const recurring = []

  for (const [, txs] of groups) {
    if (txs.length < 2) continue
    const amounts = txs.map(t => Math.abs(t.amount))
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const consistent = amounts.every(a => Math.abs(a - avg) < avg * 0.15)
    if (!consistent) continue

    const sortedDates = txs.map(t => t.transactionDate).sort()
    const lastDate = sortedDates[sortedDates.length - 1]

    recurring.push({
      user_id: TARGET_USER_ID,
      description: txs[0].description.slice(0, 255),
      amount: -(Math.round(avg * 100) / 100),
      category: categorizeTransaction(txs[0].description, -avg),
      day_of_month: parseInt(lastDate.split('-')[2]),
      confidence: txs.length >= 4 ? 0.95 : txs.length === 3 ? 0.85 : 0.70,
      last_seen: lastDate,
    })
  }

  return recurring
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2]
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`❌ Bestand niet gevonden: ${filePath}`)
    console.error('   Gebruik: SEED_USER_ID=uuid npx tsx scripts/import-abn-amro.ts "C:\\pad\\naar\\export.xls"')
    process.exit(1)
  }

  console.log(`\n📂 Inladen: ${path.resolve(filePath)}\n`)

  // 1. Parse XLS
  const rows = parseAbnXls(filePath)
  if (rows.length === 0) {
    console.error('❌ Geen transacties gevonden. Controleer of dit een ABN AMRO export is.')
    process.exit(1)
  }
  console.log(`✅ ${rows.length} transacties geparsed`)

  // 2. Bank account aanmaken of ophalen
  const accountNumber = rows[0].accountNumber
  const latestBalance = rows[rows.length - 1].endBalance

  const { data: existingAccount } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('user_id', TARGET_USER_ID)
    .eq('external_id', accountNumber)
    .maybeSingle()

  let accountId: string

  if (existingAccount) {
    accountId = existingAccount.id
    await supabase
      .from('bank_accounts')
      .update({ balance: latestBalance, updated_at: new Date().toISOString() })
      .eq('id', accountId)
    console.log(`✅ Bestaand account bijgewerkt, saldo: €${latestBalance}`)
  } else {
    const { data: newAccount, error } = await supabase
      .from('bank_accounts')
      .insert({
        user_id: TARGET_USER_ID,
        institution_name: 'ABN AMRO',
        account_name: 'ABN AMRO Betaalrekening',
        iban: accountNumber,
        currency: rows[0].currency || 'EUR',
        provider: 'manual_import',
        external_id: accountNumber,
        balance: latestBalance,
        account_type: 'CACC',
      })
      .select('id')
      .single()

    if (error || !newAccount) {
      console.error('❌ Bank account aanmaken mislukt:', error?.message)
      process.exit(1)
    }
    accountId = newAccount.id
    console.log(`✅ Bank account aangemaakt: ${accountId}`)
  }

  // 3. Categoriseer via Fynn's eigen engine
  console.log(`🧠 Categoriseren via Fynn categorize engine...`)
  const txRows = rows.map((row, i) => ({
    user_id: TARGET_USER_ID,
    account_id: accountId,
    amount: row.amount,
    currency: row.currency || 'EUR',
    description: row.description,
    category: categorizeTransaction(row.description, row.amount),
    transaction_date: row.transactionDate,
    provider: 'manual_import',
    external_id: `abn_${accountNumber}_${row.transactionDate}_${row.amount}_${i}`,
  }))
  console.log(`✅ Alle transacties gecategoriseerd`)

  // 4. Importeer in batches van 100
  console.log(`⏳ Opslaan in Supabase...`)
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
  console.log(`✅ ${inserted} transacties opgeslagen (${rows.length - inserted} duplicaten overgeslagen)`)

  // 5. Vaste lasten detecteren en opslaan
  console.log(`🔄 Vaste lasten detecteren...`)
  const recurring = detectRecurring(rows)
  if (recurring.length > 0) {
    await supabase.from('recurring_items').delete().eq('user_id', TARGET_USER_ID)
    const { error } = await supabase.from('recurring_items').insert(recurring)
    if (error) console.warn('  ⚠️  Recurring items fout:', error.message)
    else console.log(`✅ ${recurring.length} vaste lasten opgeslagen`)
  }

  // 6. Samenvatting
  const income = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0)
  const expenses = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0)

  const catCount: Record<string, { count: number; total: number }> = {}
  for (const row of txRows.filter(r => r.amount < 0)) {
    const cat = row.category
    if (!catCount[cat]) catCount[cat] = { count: 0, total: 0 }
    catCount[cat].count++
    catCount[cat].total += Math.abs(row.amount)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 IMPORT RESULTAAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Periode     : ${rows[0].transactionDate} → ${rows[rows.length-1].transactionDate}
Transacties : ${rows.length}
Inkomen     : €${income.toFixed(2)}
Uitgaven    : €${expenses.toFixed(2)}
Netto       : €${(income - expenses).toFixed(2)}
Saldo       : €${latestBalance.toFixed(2)}

📂 TOP CATEGORIEËN (uitgaven):
${Object.entries(catCount)
  .sort((a, b) => b[1].total - a[1].total)
  .slice(0, 10)
  .map(([cat, d]) => `  ${cat.padEnd(18)} ${String(d.count).padStart(3)}x   €${d.total.toFixed(0)}`)
  .join('\n')}

🔄 VASTE LASTEN GEDETECTEERD (${recurring.length}x):
${recurring
  .sort((a, b) => a.amount - b.amount)
  .slice(0, 10)
  .map(r => `  €${Math.abs(r.amount).toFixed(2).padStart(8)}  dag ${String(r.day_of_month).padStart(2)}  ${r.description.slice(0, 35)}`)
  .join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Klaar. Alle transacties zijn gecategoriseerd via Fynn engine.
  `)
}

main().catch(console.error)