/**
 * Fynn — Manual Transaction Upload API
 *
 * POST /api/upload-transactions
 *
 * Accepts a multipart form upload with:
 *   - file: CSV/XLS/XLSX file from bank export
 *   - bank: (optional) BankId — if omitted, auto-detection is used
 *   - mode: "preview" | "import" — preview returns parsed stats, import saves to DB
 *   - accountName: (optional) custom account name for the bank account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseBankExport, makeExternalId, BANK_LABELS } from '@/lib/bank-parsers'
import type { BankId, ParsedTransaction } from '@/lib/bank-parsers'
import { categorizeTransaction, isInternalTransfer, extractIbanFromDescription } from '@/lib/categorize-engine'
import { extractMerchant } from '@/lib/clean-description'

const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Convert a binary XLS/XLSX buffer to tab-separated text.
 * Uses the `xlsx` npm package (SheetJS) — must be installed: npm install xlsx
 */
function convertExcelToText(buffer: Buffer): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    })

    const lines = rows
      .filter((row: string[]) => row.some((cell: string) => cell && cell.trim()))
      .map((row: string[]) => row.join('\t'))

    if (lines.length === 0) return null
    return lines.join('\n')
  } catch (e) {
    console.warn('[upload-transactions] xlsx parse failed:', e)
    return null
  }
}

/**
 * Detect the user's own IBANs from the transaction data itself.
 * Solves the chicken-and-egg problem: at preview time, bank_accounts may be empty.
 *
 * Strategy:
 * 1. All unique accountNumbers in the parsed transactions → these are source accounts = own
 * 2. For ABN AMRO: derive full IBAN from account numbers (NLxxABNA0 + padded number)
 * 3. Extract all counter-party IBANs from descriptions
 * 4. IBANs that appear as counter-party in BOTH debit AND credit transactions
 *    are very likely own accounts (money going back and forth)
 *
 * Works for all banks — not ABN-specific.
 */
function detectOwnIbans(
  transactions: ParsedTransaction[],
  bankId: string,
  existingIbans: string[],
): string[] {
  const ownIbans = new Set<string>(existingIbans.map(i => i.replace(/\s/g, '').toUpperCase()))

  // ── Step 1: All account numbers from the file are own accounts ──
  const sourceAccounts = new Set<string>()
  for (const tx of transactions) {
    if (tx.accountNumber) {
      const acct = tx.accountNumber.replace(/\./g, '').replace(/\s/g, '').trim()
      if (acct) sourceAccounts.add(acct)
    }
  }

  // ── Step 2: Convert account numbers to IBANs ──
  for (const acct of sourceAccounts) {
    // Already a full IBAN?
    if (/^[A-Z]{2}\d{2}[A-Z]{4}\d{7,}$/i.test(acct)) {
      ownIbans.add(acct.toUpperCase())
      continue
    }

    // ABN AMRO: 9-digit account → NLxxABNA0{padded to 10}
    // We don't know the check digits, so we search for matching IBANs in descriptions
    const padded = acct.replace(/^0+/, '').padStart(10, '0')

    // Search for this account number in any IBAN in the transaction descriptions
    for (const tx of transactions) {
      const counterIban = extractIbanFromDescription(tx.description)
      if (counterIban && counterIban.includes(padded)) {
        // Found the full IBAN — but this is the counter-party IBAN, which contains our padded acct
        // Actually: we need to derive our own IBAN. For ABN AMRO: NL??ABNA0 + padded
        // The counter-party IBAN matches the source account → it IS the full IBAN of our account
        ownIbans.add(counterIban)
        break
      }
    }

    // Fallback: if ABN AMRO, try common IBAN construction
    if (bankId === 'abn_amro') {
      // Find any description that references this account as counter-party
      // The IBAN will be NLxxABNA0{10-digit} — we find exact IBANs from other txs
      const pattern = `ABNA0${padded}`
      for (const tx of transactions) {
        if (tx.description.includes(pattern)) {
          const match = tx.description.match(new RegExp(`(NL\\d{2}ABNA0${padded})`, 'i'))
          if (match) {
            ownIbans.add(match[1].toUpperCase())
            break
          }
        }
      }
    }
  }

  // ── Step 3: Targeted bidirectional IBAN detection ──
  // Catch own accounts NOT in the export (e.g. "Rekening Sjaak" NL38).
  // Only for same-bank IBANs with balanced debit/credit ratio.
  // This avoids false positives from Tikkie, verzekeringen, etc.
  if (ownIbans.size > 0) {
    // Detect bank prefix from known own IBANs (e.g. 'ABNA' for ABN AMRO)
    const bankPrefixes = new Set<string>()
    for (const iban of ownIbans) {
      const match = iban.match(/^[A-Z]{2}\d{2}([A-Z]{4})/)
      if (match) bankPrefixes.add(match[1])
    }

    const ibanDirections: Record<string, { debit: number; credit: number }> = {}
    for (const tx of transactions) {
      const counterIban = extractIbanFromDescription(tx.description)
      if (!counterIban) continue
      // Skip IBANs already known as own
      if (ownIbans.has(counterIban)) continue
      // Only consider same-bank IBANs
      const prefix = counterIban.match(/^[A-Z]{2}\d{2}([A-Z]{4})/)?.[1]
      if (!prefix || !bankPrefixes.has(prefix)) continue

      if (!ibanDirections[counterIban]) {
        ibanDirections[counterIban] = { debit: 0, credit: 0 }
      }
      if (tx.amount < 0) ibanDirections[counterIban].debit++
      else ibanDirections[counterIban].credit++
    }

    for (const [iban, dirs] of Object.entries(ibanDirections)) {
      const total = dirs.debit + dirs.credit
      // Must have significant activity AND balanced flow (ratio within 3:1)
      if (total >= 6 && dirs.debit >= 2 && dirs.credit >= 2) {
        const ratio = Math.max(dirs.debit, dirs.credit) / Math.min(dirs.debit, dirs.credit)
        if (ratio <= 2.5) {
          ownIbans.add(iban)
        }
      }
    }
  }

  return Array.from(ownIbans)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bankParam = formData.get('bank') as string | null
    const mode = (formData.get('mode') as string) || 'preview'
    const accountName = formData.get('accountName') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand geüpload' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Bestand te groot (max 10MB)' }, { status: 400 })
    }

    // ── Read file content ────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer())
    let text: string

    const isBinaryXls = buffer.length >= 2 && buffer[0] === 0xD0 && buffer[1] === 0xCF
    const isXlsx = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B

    if (isBinaryXls || isXlsx) {
      const textAttempt = buffer.toString('utf-8')
      const lines = textAttempt.split('\n').filter(l => l.trim())
      const firstLineTabCount = lines.length > 0 ? (lines[0].match(/\t/g) || []).length : 0

      if (lines.length > 1 && firstLineTabCount >= 4) {
        text = textAttempt
      } else {
        const excelText = convertExcelToText(buffer)
        if (excelText) {
          text = excelText
        } else {
          return NextResponse.json({
            error: 'Kon het Excel-bestand niet lezen. Installeer xlsx (npm install xlsx) of exporteer als CSV.',
            hint: 'ABN AMRO: download als TXT/TAB bestand',
          }, { status: 400 })
        }
      }
    } else {
      text = buffer.toString('utf-8')
      if (text.includes('\uFFFD')) {
        text = buffer.toString('latin1')
      }
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'Bestand is leeg' }, { status: 400 })
    }

    // ── Parse transactions ───────────────────────────────────────
    const bankId = bankParam as BankId | null
    const result = parseBankExport(text, bankId, file.name)

    if (result.errors.length > 0 && result.transactions.length === 0) {
      return NextResponse.json({
        error: result.errors[0],
        errors: result.errors,
        detectedBank: result.bank,
        detectedBankLabel: result.bankLabel,
      }, { status: 400 })
    }

    // ── Build userIbans: DB + file-derived ───────────────────────
    const { data: userAccounts } = await supabase
      .from('bank_accounts')
      .select('iban')
      .eq('user_id', user.id)
      .not('iban', 'is', null)

    const dbIbans: string[] = (userAccounts ?? [])
      .map(a => a.iban)
      .filter((iban): iban is string => iban !== null && iban !== '')

    // Detect own IBANs from the transaction data itself
    // This solves the chicken-and-egg problem at preview time
    const userIbans = detectOwnIbans(result.transactions, result.bank, dbIbans)

    // ── Calculate stats using categorize-engine ─────────────────
    // Categorize each transaction to determine real income vs toeslagen vs expenses
    // This prevents Tikkie, private transfers, etc. from inflating income numbers
    const categorizedPreview = result.transactions.map(t => ({
      ...t,
      category: isInternalTransfer(t.description, userIbans)
        ? 'interne_overboeking' as const
        : categorizeTransaction(t.description, t.amount, undefined, userIbans),
    }))

    const internalCount = categorizedPreview
      .filter(t => t.category === 'interne_overboeking')
      .length

    const totalIncome = categorizedPreview
      .filter(t => t.category === 'inkomen')
      .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = categorizedPreview
      .filter(t => t.category !== 'interne_overboeking' && t.category !== 'inkomen' && t.category !== 'toeslagen' && t.category !== 'sparen' && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    // Overige inkomsten: all positive transactions not categorized as inkomen or intern
    // Includes: toeslagen, Tikkie terugbetalingen, privé overboekingen, verzekeringsuitkeringen etc.
    const totalOverigInkomsten = categorizedPreview
      .filter(t => t.category !== 'interne_overboeking' && t.category !== 'inkomen' && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)

    const stats = {
      bank: result.bank,
      bankLabel: result.bankLabel,
      transactionCount: result.transactions.length,
      period: result.period,
      accountNumber: result.accountNumber,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalOverigInkomsten: Math.round(totalOverigInkomsten * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      internalTransfers: internalCount,
      errors: result.errors,
    }

    // ── Preview mode ─────────────────────────────────────────────
    if (mode === 'preview') {
      return NextResponse.json({ success: true, mode: 'preview', ...stats })
    }

    // ── Import mode ──────────────────────────────────────────────
    const accountIban = result.accountNumber || `manual_${result.bank}_${user.id}`
    const institutionName = BANK_LABELS[result.bank] || 'Onbekend'
    const displayName = accountName || `${institutionName} Betaalrekening`

    const latestTxWithBalance = [...result.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find(t => t.balanceAfter !== null)

    const { data: existingAccount } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('external_id', `manual_${accountIban}`)
      .maybeSingle()

    let accountId: string

    if (existingAccount) {
      accountId = existingAccount.id
      if (latestTxWithBalance?.balanceAfter) {
        await supabase
          .from('bank_accounts')
          .update({ balance: latestTxWithBalance.balanceAfter, updated_at: new Date().toISOString() })
          .eq('id', accountId)
      }
    } else {
      const { data: newAccount, error: accountError } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: user.id,
          institution_name: institutionName,
          account_name: displayName,
          iban: result.accountNumber || null,
          currency: 'EUR',
          provider: 'manual_upload',
          external_id: `manual_${accountIban}`,
          balance: latestTxWithBalance?.balanceAfter || 0,
          account_type: 'CACC',
        })
        .select('id')
        .single()

      if (accountError || !newAccount) {
        console.error('[upload-transactions] Account aanmaken mislukt:', accountError)
        return NextResponse.json({ error: 'Kon bankrekening niet aanmaken' }, { status: 500 })
      }
      accountId = newAccount.id

      // Re-fetch user IBANs now that we created the account
      if (result.accountNumber && !userIbans.includes(result.accountNumber)) {
        userIbans.push(result.accountNumber)
      }
    }

    // Categorization layers: overrides → merchant_map → IBAN check + rule engine
    const { data: overrides } = await supabase
      .from('category_overrides')
      .select('description_pattern, category')
      .eq('user_id', user.id)

    const overrideMap: Record<string, string> = {}
    overrides?.forEach(o => { overrideMap[o.description_pattern] = o.category })

    // Fetch merchant_map keyed by merchant_key (the primary lookup used everywhere)
    const { data: merchantMap } = await supabase
      .from('merchant_map')
      .select('merchant_key, category')
      .not('category', 'is', null)

    const merchantKeyCategory: Record<string, string> = {}
    merchantMap?.forEach(m => { merchantKeyCategory[m.merchant_key] = m.category })

    // Also fetch user-level merchant overrides
    const { data: merchantOverrides } = await supabase
      .from('merchant_user_overrides')
      .select('merchant_key, category')
      .eq('user_id', user.id)
      .not('category', 'is', null)

    const merchantOverrideMap: Record<string, string> = {}
    merchantOverrides?.forEach(o => { merchantOverrideMap[o.merchant_key] = o.category! })

    const txRows = result.transactions.map((tx: ParsedTransaction, i: number) => {
      const descPattern = tx.description.toLowerCase().replace(/'/g, '').trim()

      // Extract merchant identity from description
      const { merchantKey, merchantName } = extractMerchant(tx.description, Math.abs(tx.amount))

      // Priority: user overrides → merchant user override → merchant_map → IBAN-aware categorization
      const category = overrideMap[descPattern]
        || merchantOverrideMap[merchantKey]
        || merchantKeyCategory[merchantKey]
        || categorizeTransaction(tx.description, tx.amount, undefined, userIbans)

      return {
        user_id: user.id,
        account_id: accountId,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        category,
        merchant_key: merchantKey,
        merchant_name: merchantName,
        transaction_date: tx.date,
        provider: 'manual_upload',
        external_id: makeExternalId(result.bank, accountIban, tx.date, tx.amount, i, tx.counterparty.slice(0, 20)),
      }
    })

    // Upsert in batches of 100
    let inserted = 0
    let failed = 0
    for (let i = 0; i < txRows.length; i += 100) {
      const chunk = txRows.slice(i, i + 100)
      const { data, error } = await supabase
        .from('transactions')
        .upsert(chunk, { onConflict: 'external_id', ignoreDuplicates: true })
        .select('id')

      if (error) {
        console.warn(`[upload-transactions] Batch ${i} fout:`, error.message)
        failed += chunk.length
      } else {
        inserted += data?.length || 0
      }
    }

    // Seed merchant_map with merchant_key (skip internal transfers)
    const seenMerchantKeys = new Set<string>()
    const merchantSeeds: { merchant_key: string; merchant_name: string; category: string }[] = []

    for (const tx of result.transactions) {
      if (!tx.counterparty || tx.counterparty === 'Onbekend') continue
      if (isInternalTransfer(tx.description, userIbans)) continue

      const { merchantKey, merchantName } = extractMerchant(tx.description, Math.abs(tx.amount))
      if (seenMerchantKeys.has(merchantKey) || merchantKey === 'nl:unknown') continue
      seenMerchantKeys.add(merchantKey)

      merchantSeeds.push({
        merchant_key: merchantKey,
        merchant_name: merchantName,
        category: categorizeTransaction(tx.description, tx.amount, undefined, userIbans),
      })
    }

    for (const seed of merchantSeeds.slice(0, 300)) {
      await supabase
        .from('merchant_map')
        .upsert(seed, { onConflict: 'merchant_key', ignoreDuplicates: true })
        .select()
        .maybeSingle()
    }

    // Trigger recurring detection (non-blocking)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      fetch(`${baseUrl}/api/recurring/detect`, {
        method: 'POST',
        headers: { 'Cookie': request.headers.get('cookie') ?? '' },
      }).catch(() => {})
    } catch {}

    return NextResponse.json({
      success: true,
      mode: 'import',
      ...stats,
      inserted,
      duplicatesSkipped: result.transactions.length - inserted - failed,
      failed,
      accountId,
    })

  } catch (error) {
    console.error('[upload-transactions] Unexpected error:', error)
    return NextResponse.json({ error: 'Er ging iets mis bij het uploaden' }, { status: 500 })
  }
}