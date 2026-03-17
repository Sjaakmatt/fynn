/**
 * Fynn — Bank Transaction Parsers
 *
 * Supports CSV/XLS exports from all major NL/BE banks.
 * Each parser normalizes to a common ParsedTransaction format.
 *
 * Supported banks:
 *   NL: ABN AMRO, ING, Rabobank, SNS, ASN, RegioBank, Knab, bunq, Triodos
 *   BE: KBC, BNP Paribas Fortis, Belfius, Argenta
 *
 * Auto-detection tries to identify the bank from headers/structure.
 * Falls back to manual bank selection if detection fails.
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  date: string           // YYYY-MM-DD
  amount: number         // negative = expense, positive = income
  description: string    // best available description
  counterparty: string   // name of other party (if available)
  counterIban: string    // IBAN of other party (if available)
  currency: string       // EUR default
  accountNumber: string  // own IBAN/account number
  balanceAfter: number | null  // balance after transaction (if available)
}

export interface ParseResult {
  bank: BankId
  bankLabel: string
  transactions: ParsedTransaction[]
  accountNumber: string
  period: { from: string; to: string }
  errors: string[]
}

export type BankId =
  | 'abn_amro' | 'ing' | 'rabobank'
  | 'sns' | 'asn' | 'regiobank'
  | 'knab' | 'bunq' | 'triodos'
  | 'kbc' | 'bnp_paribas_fortis' | 'belfius' | 'argenta'

export const BANK_LABELS: Record<BankId, string> = {
  abn_amro: 'ABN AMRO',
  ing: 'ING',
  rabobank: 'Rabobank',
  sns: 'SNS Bank',
  asn: 'ASN Bank',
  regiobank: 'RegioBank',
  knab: 'Knab',
  bunq: 'bunq',
  triodos: 'Triodos Bank',
  kbc: 'KBC',
  bnp_paribas_fortis: 'BNP Paribas Fortis',
  belfius: 'Belfius',
  argenta: 'Argenta',
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

/** Parse NL-format date strings to YYYY-MM-DD */
function parseDate(raw: string): string {
  const s = raw.trim().replace(/"/g, '')
  // YYYYMMDD
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // MM/DD/YYYY (unlikely for NL/BE but handle anyway)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  return s
}

/** Parse NL-format amounts: "1.234,56" or "-1234.56" */
function parseAmount(raw: string): number {
  if (!raw) return 0
  let s = raw.trim().replace(/"/g, '').replace(/\s/g, '')
  // NL format: 1.234,56 → comma is decimal separator
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  // Handle comma as thousands separator: 1,234.56
  else if (s.includes(',') && s.lastIndexOf('.') > s.lastIndexOf(',')) {
    s = s.replace(/,/g, '')
  }
  // Just comma, no dot: "1234,56"
  else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/** Split CSV line respecting quoted fields */
function splitCsvLine(line: string, separator: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === separator && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result.map(f => f.replace(/^"|"$/g, ''))
}

/** Parse CSV text to rows, detecting separator */
function parseCsv(text: string, forceSeparator?: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  // Detect separator from first line
  const firstLine = lines[0]
  let sep = forceSeparator || ','
  if (!forceSeparator) {
    const semicolonCount = (firstLine.match(/;/g) || []).length
    const commaCount = (firstLine.match(/,/g) || []).length
    const tabCount = (firstLine.match(/\t/g) || []).length
    if (tabCount > semicolonCount && tabCount > commaCount) sep = '\t'
    else if (semicolonCount > commaCount) sep = ';'
  }

  const headers = splitCsvLine(lines[0], sep)
  const rows = lines.slice(1).map(line => splitCsvLine(line, sep)).filter(r => r.length >= 3)

  return { headers, rows }
}

/** Extract IBAN from a text string (NL/BE format) */
export function extractIbanFromText(text: string): string {
  // Match NL or BE IBANs — ABN AMRO format: "IBAN: NL39ABNA0104545003" or "IBAN/NL39ABNA..."
  const match = text.match(/\b((?:NL|BE)\d{2}[A-Z]{4}\d{6,10})\b/i)
  return match ? match[1].toUpperCase() : ''
}

/** Extract counterparty name from ABN AMRO description */
function extractAbnCounterparty(desc: string): { counterparty: string; counterIban: string } {
  const counterIban = extractIbanFromText(desc)

  // Try to find NAME/ field: "/NAME/Some Person/REMI/..."
  const nameMatch = desc.match(/\/NAME\/([^/]+)/i)
  if (nameMatch) {
    const name = nameMatch[1].trim()
    // Clean up: remove trailing BIC codes like "ABNANL2A"
    const cleaned = name.replace(/\s+[A-Z]{6,8}\s*$/, '').trim()
    return { counterparty: cleaned || name, counterIban }
  }

  // Try "Naam:" field: "Naam: Some Person"
  const naamMatch = desc.match(/Naam:\s*([^\s](?:[^/\n])*)/i)
  if (naamMatch) {
    const name = naamMatch[1].trim().replace(/\s+[A-Z]{6,8}\s*$/, '').trim()
    return { counterparty: name, counterIban }
  }

  // Creditor/debtor name for incasso: "Naam: NETFLIX INTERNATIONAL B.V."
  const incassoMatch = desc.match(/(?:Incassant|Naam):\s*([A-Z][A-Za-z\s.&\-']+?)(?:\s{2,}|Machtiging|IBAN|$)/i)
  if (incassoMatch) {
    return { counterparty: incassoMatch[1].trim(), counterIban }
  }

  return { counterparty: '', counterIban }
}

/** Clean up description strings */
function cleanDescription(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 500)
}

/** Create a deterministic external_id for deduplication */
function makeExternalId(bank: string, accountNumber: string, date: string, amount: number, index: number, extra?: string, userId?: string): string {
  const base = userId 
    ? `${userId}_${bank}_${accountNumber}_${date}_${amount}_${index}`
    : `${bank}_${accountNumber}_${date}_${amount}_${index}`
  return extra ? `${base}_${extra}` : base
}

/** Build ParseResult from transactions array */
function buildResult(bank: BankId, transactions: ParsedTransaction[], errors: string[]): ParseResult {
  const dates = transactions.map(t => t.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  return {
    bank,
    bankLabel: BANK_LABELS[bank],
    transactions,
    accountNumber: transactions[0]?.accountNumber || '',
    period: {
      from: dates[0] || '',
      to: dates[dates.length - 1] || '',
    },
    errors,
  }
}

// ─── PARSERS ─────────────────────────────────────────────────────────────────

/**
 * ABN AMRO — Tab-separated XLS (no headers)
 * Columns: Rekeningnummer | Muntsoort | Transactiedatum | Beginstand | Eindstand | Rentedatum | Bedrag | Omschrijving
 */
function parseAbnAmro(text: string): ParseResult {
  const errors: string[] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  const transactions: ParsedTransaction[] = []

  for (const line of lines) {
    const cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 8) continue
    // Skip header row if present
    if (/rekeningnummer|accountnumber|datum/i.test(cols[0])) continue

    const amount = parseAmount(cols[6])
    if (amount === 0 && cols[6].trim() === '') continue

    const desc = cleanDescription(cols[7])
    const { counterparty, counterIban } = extractAbnCounterparty(cols[7])

    transactions.push({
      date: parseDate(cols[2]),
      amount,
      description: desc,
      counterparty: counterparty || '',
      counterIban,
      currency: cols[1] || 'EUR',
      accountNumber: cols[0],
      balanceAfter: parseAmount(cols[4]) || null,
    })
  }

  return buildResult('abn_amro', transactions, errors)
}

/**
 * ING — Semicolon-separated CSV (since 2020 format change)
 * Headers: "Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"Mutatiesoort";"Mededelingen";"Saldo na mutatie";"Tag"
 * Older format used commas — we handle both.
 */
function parseIng(text: string): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  // Column index lookup (case-insensitive, handle both old and new headers)
  const h = headers.map(s => s.toLowerCase().trim())
  const iDate = h.findIndex(c => c.includes('datum'))
  const iName = h.findIndex(c => c.includes('naam') || c.includes('omschrijving'))
  const iAccount = h.findIndex(c => c === 'rekening')
  const iCounter = h.findIndex(c => c.includes('tegenrekening'))
  const iAfBij = h.findIndex(c => c.includes('af bij'))
  const iAmount = h.findIndex(c => c.includes('bedrag'))
  const iType = h.findIndex(c => c.includes('mutatiesoort'))
  const iDetails = h.findIndex(c => c.includes('mededeling'))
  const iBalance = h.findIndex(c => c.includes('saldo'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('ing', [], ['Kan ING kolommen niet herkennen. Verwacht: Datum, Bedrag (EUR)'])
  }

  for (const row of rows) {
    let amount = parseAmount(row[iAmount] || '0')
    // "Af Bij" column: "Af" = expense (negative), "Bij" = income (positive)
    if (iAfBij !== -1) {
      const afBij = (row[iAfBij] || '').toLowerCase().trim()
      if (afBij === 'af' && amount > 0) amount = -amount
      if (afBij === 'bij' && amount < 0) amount = Math.abs(amount)
    }

    const description = [row[iName] || '', row[iDetails] || '']
      .filter(Boolean)
      .join(' — ')

    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription(description),
      counterparty: cleanDescription(row[iName] || ''),
      counterIban: row[iCounter] || '',
      currency: 'EUR',
      accountNumber: row[iAccount] || '',
      balanceAfter: iBalance !== -1 ? parseAmount(row[iBalance] || '') || null : null,
    })
  }

  return buildResult('ing', transactions, errors)
}

/**
 * Rabobank — Comma-separated CSV
 * Headers: "IBAN/BBAN","Munt","BIC","Volgnr","Datum","Rentedatum","Bedrag","Saldo na trn",
 *          "Tegenrekening IBAN/BBAN","Naam tegenpartij","Naam uiteindelijke partij",
 *          "Naam initiërende partij","BIC tegenpartij","Code","Batch ID",
 *          "Transactiereferentie","Machtigingskenmerk","Incassant ID",
 *          "Betalingskenmerk","Omschrijving-1","Omschrijving-2","Omschrijving-3",
 *          "Reden retour","Oorspr bedrag","Oorspr munt","Koers"
 */
function parseRabobank(text: string): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())
  const iIban = h.findIndex(c => c.includes('iban') && !c.includes('tegen'))
  const iCurrency = h.findIndex(c => c.includes('munt') && !c.includes('oorspr'))
  const iDate = h.findIndex(c => c === 'datum')
  const iAmount = h.findIndex(c => c === 'bedrag')
  const iBalance = h.findIndex(c => c.includes('saldo'))
  const iCounterIban = h.findIndex(c => c.includes('tegenrekening'))
  const iCounterName = h.findIndex(c => c.includes('naam tegenpartij'))
  const iDesc1 = h.findIndex(c => c.includes('omschrijving-1') || c === 'omschrijving 1')
  const iDesc2 = h.findIndex(c => c.includes('omschrijving-2') || c === 'omschrijving 2')
  const iDesc3 = h.findIndex(c => c.includes('omschrijving-3') || c === 'omschrijving 3')
  const iPaymentRef = h.findIndex(c => c.includes('betalingskenmerk'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('rabobank', [], ['Kan Rabobank kolommen niet herkennen. Verwacht: Datum, Bedrag'])
  }

  for (const row of rows) {
    const amount = parseAmount(row[iAmount] || '0')
    const descriptions = [
      row[iCounterName] || '',
      row[iDesc1] || '',
      row[iDesc2] || '',
      row[iDesc3] || '',
      row[iPaymentRef] || '',
    ].filter(Boolean)

    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription(descriptions.join(' ')),
      counterparty: cleanDescription(row[iCounterName] || ''),
      counterIban: row[iCounterIban] || '',
      currency: row[iCurrency] || 'EUR',
      accountNumber: row[iIban] || '',
      balanceAfter: iBalance !== -1 ? parseAmount(row[iBalance] || '') || null : null,
    })
  }

  return buildResult('rabobank', transactions, errors)
}

/**
 * Volksbank (SNS, ASN, RegioBank) — CSV format
 * These banks use similar/identical CSV formats.
 * Headers vary but typically include:
 * Datum, Naam / Omschrijving, Rekening, Tegenrekening, Code, Af Bij, Bedrag, Mutatiesoort, Mededelingen
 * OR
 * "Transactiedatum","Valutadatum","Beginsaldo","Eindsaldo","Rentedatum","Tegenrekening","Naam tegenrekening",
 * "Adres","Postcode","Plaats","Valutasoort","Saldo","Muntsoort","Transactiebedrag","Bij/Af","ID","Omschrijving","Machtigingsnummer"
 */
function parseVolksbank(text: string, bankId: 'sns' | 'asn' | 'regiobank'): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())

  // Try to detect which Volksbank format we have
  const iDate = h.findIndex(c => c.includes('datum') && !c.includes('valuta') && !c.includes('rente'))
  const iFallbackDate = iDate === -1 ? h.findIndex(c => c.includes('transactiedatum')) : iDate
  const dateCol = iFallbackDate !== -1 ? iFallbackDate : 0

  const iName = h.findIndex(c => c.includes('naam'))
  const iAccount = h.findIndex(c => c === 'rekening')
  const iCounter = h.findIndex(c => c.includes('tegenrekening') && !c.includes('naam'))
  const iAfBij = h.findIndex(c => c.includes('af') && c.includes('bij'))
  const iAmount = h.findIndex(c => c.includes('bedrag') || c.includes('transactiebedrag'))
  const iDesc = h.findIndex(c => c.includes('omschrijving') || c.includes('mededeling'))
  const iBalance = h.findIndex(c => c.includes('saldo') && !c.includes('begin'))

  if (iAmount === -1) {
    return buildResult(bankId, [], [`Kan ${BANK_LABELS[bankId]} kolommen niet herkennen`])
  }

  for (const row of rows) {
    let amount = parseAmount(row[iAmount] || '0')
    if (iAfBij !== -1) {
      const afBij = (row[iAfBij] || '').toLowerCase().trim()
      if ((afBij === 'af' || afBij === 'a') && amount > 0) amount = -amount
      if ((afBij === 'bij' || afBij === 'b') && amount < 0) amount = Math.abs(amount)
    }

    const description = [row[iName] || '', row[iDesc] || '']
      .filter(Boolean)
      .join(' — ')

    transactions.push({
      date: parseDate(row[dateCol] || ''),
      amount,
      description: cleanDescription(description),
      counterparty: cleanDescription(row[iName] || ''),
      counterIban: iCounter !== -1 ? (row[iCounter] || '') : '',
      currency: 'EUR',
      accountNumber: iAccount !== -1 ? (row[iAccount] || '') : '',
      balanceAfter: iBalance !== -1 ? parseAmount(row[iBalance] || '') || null : null,
    })
  }

  return buildResult(bankId, transactions, errors)
}

/**
 * Knab — Comma-separated CSV
 * Similar to ING format:
 * Rekeningnummer, Transactiedatum, Valutadatum, Beginsaldo, Eindsaldo, Rentedatum,
 * Tegenrekening, Naam tegenrekening, Omschrijving, Bedrag, Af/Bij
 */
function parseKnab(text: string): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())
  const iAccount = h.findIndex(c => c.includes('rekeningnummer'))
  const iDate = h.findIndex(c => c.includes('transactiedatum'))
  const iCounter = h.findIndex(c => c.includes('tegenrekening') && !c.includes('naam'))
  const iCounterName = h.findIndex(c => c.includes('naam'))
  const iDesc = h.findIndex(c => c.includes('omschrijving'))
  const iAmount = h.findIndex(c => c.includes('bedrag'))
  const iAfBij = h.findIndex(c => c.includes('af') || c.includes('bij'))
  const iBalance = h.findIndex(c => c.includes('eindsaldo') || c.includes('saldo'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('knab', [], ['Kan Knab kolommen niet herkennen'])
  }

  for (const row of rows) {
    let amount = parseAmount(row[iAmount] || '0')
    if (iAfBij !== -1) {
      const afBij = (row[iAfBij] || '').toLowerCase().trim()
      if (afBij === 'af' && amount > 0) amount = -amount
      if (afBij === 'bij' && amount < 0) amount = Math.abs(amount)
    }

    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription([row[iCounterName] || '', row[iDesc] || ''].filter(Boolean).join(' — ')),
      counterparty: cleanDescription(row[iCounterName] || ''),
      counterIban: iCounter !== -1 ? (row[iCounter] || '') : '',
      currency: 'EUR',
      accountNumber: iAccount !== -1 ? (row[iAccount] || '') : '',
      balanceAfter: iBalance !== -1 ? parseAmount(row[iBalance] || '') || null : null,
    })
  }

  return buildResult('knab', transactions, errors)
}

/**
 * bunq — CSV export
 * Headers: "Date","Amount","Account","Counterparty","Name","Description"
 * bunq also supports MT940/CAMT but CSV is most common for consumers
 */
function parseBunq(text: string): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())
  const iDate = h.findIndex(c => c === 'date' || c === 'datum')
  const iAmount = h.findIndex(c => c === 'amount' || c === 'bedrag')
  const iAccount = h.findIndex(c => c === 'account' || c === 'rekening')
  const iCounter = h.findIndex(c => c.includes('counterparty') || c.includes('tegenrekening'))
  const iName = h.findIndex(c => c === 'name' || c === 'naam')
  const iDesc = h.findIndex(c => c.includes('description') || c.includes('omschrijving'))
  const iBalance = h.findIndex(c => c.includes('balance') || c.includes('saldo'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('bunq', [], ['Kan bunq kolommen niet herkennen'])
  }

  for (const row of rows) {
    const amount = parseAmount(row[iAmount] || '0')
    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription([row[iName] || '', row[iDesc] || ''].filter(Boolean).join(' — ')),
      counterparty: cleanDescription(row[iName] || ''),
      counterIban: iCounter !== -1 ? (row[iCounter] || '') : '',
      currency: 'EUR',
      accountNumber: iAccount !== -1 ? (row[iAccount] || '') : '',
      balanceAfter: iBalance !== -1 ? parseAmount(row[iBalance] || '') || null : null,
    })
  }

  return buildResult('bunq', transactions, errors)
}

/**
 * Triodos Bank — CSV
 * Format varies but typically:
 * Datum, Naam / Omschrijving, Rekening, Tegenrekening, Code, Af Bij, Bedrag, Mutatiesoort, Mededelingen
 */
function parseTriodos(text: string): ParseResult {
  // Triodos uses a similar format to ING/Volksbank
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())
  const iDate = h.findIndex(c => c.includes('datum'))
  const iName = h.findIndex(c => c.includes('naam') || c.includes('omschrijving'))
  const iAccount = h.findIndex(c => c === 'rekening')
  const iCounter = h.findIndex(c => c.includes('tegenrekening'))
  const iAfBij = h.findIndex(c => c.includes('af') && c.includes('bij'))
  const iAmount = h.findIndex(c => c.includes('bedrag'))
  const iDesc = h.findIndex(c => c.includes('mededeling'))
  const iBalance = h.findIndex(c => c.includes('saldo'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('triodos', [], ['Kan Triodos kolommen niet herkennen'])
  }

  for (const row of rows) {
    let amount = parseAmount(row[iAmount] || '0')
    if (iAfBij !== -1) {
      const afBij = (row[iAfBij] || '').toLowerCase().trim()
      if (afBij === 'af' && amount > 0) amount = -amount
      if (afBij === 'bij' && amount < 0) amount = Math.abs(amount)
    }

    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription([row[iName] || '', row[iDesc] || ''].filter(Boolean).join(' — ')),
      counterparty: cleanDescription(row[iName] || ''),
      counterIban: iCounter !== -1 ? (row[iCounter] || '') : '',
      currency: 'EUR',
      accountNumber: iAccount !== -1 ? (row[iAccount] || '') : '',
      balanceAfter: iBalance !== -1 ? parseAmount(row[iBalance] || '') || null : null,
    })
  }

  return buildResult('triodos', transactions, errors)
}

/**
 * KBC — CSV export
 * Headers: Rekeningnummer;Rubrieknaam;Naam;Munt;Afschriftnummer;Datum;Omschrijving;
 *          Valuta;Bedrag;Saldo;credit;debet;rekeningnummer tegenpartij;
 *          BIC tegenpartij;Naam tegenpartij;Adres tegenpartij;
 *          gestructureerde mededeling;Vrije mededeling
 */
function parseKbc(text: string): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())
  const iAccount = h.findIndex(c => c === 'rekeningnummer')
  const iDate = h.findIndex(c => c === 'datum')
  const iDesc = h.findIndex(c => c === 'omschrijving')
  const iAmount = h.findIndex(c => c === 'bedrag')
  const iBalance = h.findIndex(c => c === 'saldo')
  const iCounterIban = h.findIndex(c => c.includes('rekeningnummer tegenpartij'))
  const iCounterName = h.findIndex(c => c.includes('naam tegenpartij'))
  const iStructuredMsg = h.findIndex(c => c.includes('gestructureerde'))
  const iFreeMsg = h.findIndex(c => c.includes('vrije'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('kbc', [], ['Kan KBC kolommen niet herkennen'])
  }

  for (const row of rows) {
    const amount = parseAmount(row[iAmount] || '0')
    const descriptions = [
      row[iCounterName] || '',
      row[iDesc] || '',
      row[iFreeMsg] || '',
      row[iStructuredMsg] || '',
    ].filter(Boolean)

    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription(descriptions.join(' ')),
      counterparty: cleanDescription(row[iCounterName] || ''),
      counterIban: iCounterIban !== -1 ? (row[iCounterIban] || '') : '',
      currency: 'EUR',
      accountNumber: iAccount !== -1 ? (row[iAccount] || '') : '',
      balanceAfter: iBalance !== -1 ? parseAmount(row[iBalance] || '') || null : null,
    })
  }

  return buildResult('kbc', transactions, errors)
}

/**
 * BNP Paribas Fortis — CSV export
 * Headers (NL): Volgnummer;Uitvoeringsdatum;Valutadatum;Bedrag;Valuta rekening;
 *               TEGENPARTIJ VAN DE VERRICHTING;Details;Rekeningnummer
 * OR newer format with more columns
 */
function parseBnpParibasFortis(text: string): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())
  const iDate = h.findIndex(c => c.includes('uitvoeringsdatum') || c.includes('datum'))
  const iAmount = h.findIndex(c => c === 'bedrag')
  const iCounter = h.findIndex(c => c.includes('tegenpartij'))
  const iDetails = h.findIndex(c => c.includes('details') || c.includes('mededeling'))
  const iAccount = h.findIndex(c => c.includes('rekeningnummer') && !c.includes('tegen'))
  const iBalance = h.findIndex(c => c.includes('saldo'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('bnp_paribas_fortis', [], ['Kan BNP Paribas Fortis kolommen niet herkennen'])
  }

  for (const row of rows) {
    const amount = parseAmount(row[iAmount] || '0')
    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription([row[iCounter] || '', row[iDetails] || ''].filter(Boolean).join(' — ')),
      counterparty: cleanDescription(row[iCounter] || ''),
      counterIban: '',
      currency: 'EUR',
      accountNumber: iAccount !== -1 ? (row[iAccount] || '') : '',
      balanceAfter: iBalance !== -1 ? parseAmount(row[iBalance] || '') || null : null,
    })
  }

  return buildResult('bnp_paribas_fortis', transactions, errors)
}

/**
 * Belfius — CSV export (semicolon-separated)
 * Headers: Rekening;Boekingsdatum;Afschriftnummer;Transactienummer;Rekening tegenpartij;
 *          Naam tegenpartij;Straat en nummer;Postcode en plaats;Transactie;Valutadatum;
 *          Bedrag;Devies;BIC;Landcode;Mededelingen
 */
function parseBelfius(text: string): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())
  const iAccount = h.findIndex(c => c === 'rekening')
  const iDate = h.findIndex(c => c.includes('boekingsdatum') || c.includes('datum'))
  const iCounterIban = h.findIndex(c => c.includes('rekening tegenpartij'))
  const iCounterName = h.findIndex(c => c.includes('naam tegenpartij'))
  const iType = h.findIndex(c => c === 'transactie')
  const iAmount = h.findIndex(c => c === 'bedrag')
  const iCurrency = h.findIndex(c => c === 'devies' || c.includes('munt'))
  const iDetails = h.findIndex(c => c.includes('mededeling'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('belfius', [], ['Kan Belfius kolommen niet herkennen'])
  }

  for (const row of rows) {
    const amount = parseAmount(row[iAmount] || '0')
    const descriptions = [
      row[iCounterName] || '',
      row[iType] || '',
      row[iDetails] || '',
    ].filter(Boolean)

    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription(descriptions.join(' ')),
      counterparty: cleanDescription(row[iCounterName] || ''),
      counterIban: iCounterIban !== -1 ? (row[iCounterIban] || '') : '',
      currency: iCurrency !== -1 ? (row[iCurrency] || 'EUR') : 'EUR',
      accountNumber: iAccount !== -1 ? (row[iAccount] || '') : '',
      balanceAfter: null,
    })
  }

  return buildResult('belfius', transactions, errors)
}

/**
 * Argenta — CSV export (semicolon-separated)
 * Headers: Rekening;Boekingsdatum;Referentie;Omschrijving;Bedrag;Munt;Valutadatum;
 *          Rekeningnummer tegenpartij;Naam tegenpartij;Mededeling
 */
function parseArgenta(text: string): ParseResult {
  const errors: string[] = []
  const { headers, rows } = parseCsv(text)
  const transactions: ParsedTransaction[] = []

  const h = headers.map(s => s.toLowerCase().trim())
  const iAccount = h.findIndex(c => c === 'rekening')
  const iDate = h.findIndex(c => c.includes('boekingsdatum') || c.includes('datum'))
  const iDesc = h.findIndex(c => c.includes('omschrijving'))
  const iAmount = h.findIndex(c => c === 'bedrag')
  const iCounterIban = h.findIndex(c => c.includes('rekeningnummer tegenpartij'))
  const iCounterName = h.findIndex(c => c.includes('naam tegenpartij'))
  const iDetails = h.findIndex(c => c.includes('mededeling'))

  if (iDate === -1 || iAmount === -1) {
    return buildResult('argenta', [], ['Kan Argenta kolommen niet herkennen'])
  }

  for (const row of rows) {
    const amount = parseAmount(row[iAmount] || '0')
    transactions.push({
      date: parseDate(row[iDate] || ''),
      amount,
      description: cleanDescription([row[iCounterName] || '', row[iDesc] || '', row[iDetails] || ''].filter(Boolean).join(' ')),
      counterparty: cleanDescription(row[iCounterName] || ''),
      counterIban: iCounterIban !== -1 ? (row[iCounterIban] || '') : '',
      currency: 'EUR',
      accountNumber: iAccount !== -1 ? (row[iAccount] || '') : '',
      balanceAfter: null,
    })
  }

  return buildResult('argenta', transactions, errors)
}

// ─── AUTO-DETECTION ──────────────────────────────────────────────────────────

/**
 * Try to detect which bank the file came from based on content patterns.
 * Returns the BankId or null if detection fails.
 */
export function detectBank(text: string, fileName?: string): BankId | null {
  const lower = text.toLowerCase()
  const firstLine = text.split('\n')[0] || ''
  const firstLineLower = firstLine.toLowerCase()

  // ABN AMRO: tab-separated, no headers, 8 columns, starts with account number
  // ABN exports are typically .TAB or .XLS files that are actually tab-separated text
  const firstTabCols = firstLine.split('\t')
  if (firstTabCols.length >= 8 && /^[A-Z]{2}\d{2}[A-Z]{4}\d+$|^\d{9,}$/.test(firstTabCols[0].replace(/"/g, '').trim())) {
    return 'abn_amro'
  }

  // ABN AMRO: XLS with headers (Rekeningnummer + Muntsoort + Beginsaldo/Eindsaldo)
  // Distinguishes from Knab which also has Rekeningnummer + Transactiedatum
  if (firstLineLower.includes('rekeningnummer') && firstLineLower.includes('muntsoort') &&
      (firstLineLower.includes('beginsaldo') || firstLineLower.includes('eindsaldo'))) {
    return 'abn_amro'
  }

  // ING: has specific headers with "Naam / Omschrijving" and "Af Bij"
  if (firstLineLower.includes('naam / omschrijving') || firstLineLower.includes('naam/omschrijving')) {
    if (firstLineLower.includes('af bij') || firstLineLower.includes('mutatiesoort')) {
      return 'ing'
    }
  }

  // Rabobank: has "IBAN/BBAN" as first column and specific Rabo headers
  if (firstLineLower.includes('iban/bban') && firstLineLower.includes('volgnr')) {
    return 'rabobank'
  }

  // KBC: has "Rubrieknaam" column (unique to KBC)
  if (firstLineLower.includes('rubrieknaam')) {
    return 'kbc'
  }

  // BNP Paribas Fortis: has "Uitvoeringsdatum" and "TEGENPARTIJ VAN DE VERRICHTING"
  if (firstLineLower.includes('uitvoeringsdatum') || firstLineLower.includes('tegenpartij van de verrichting')) {
    return 'bnp_paribas_fortis'
  }

  // Belfius: has "Boekingsdatum" + "Afschriftnummer" + "Transactienummer"
  if (firstLineLower.includes('boekingsdatum') && firstLineLower.includes('afschriftnummer')) {
    return 'belfius'
  }

  // Argenta: has "Boekingsdatum" + "Referentie" (but not Afschriftnummer like Belfius)
  if (firstLineLower.includes('boekingsdatum') && firstLineLower.includes('referentie') && !firstLineLower.includes('afschriftnummer')) {
    return 'argenta'
  }

  // bunq: has "Date" and "Counterparty" (English headers)
  if (firstLineLower.includes('counterparty') || (firstLineLower.includes('date') && firstLineLower.includes('amount') && firstLineLower.includes('name'))) {
    return 'bunq'
  }

  // Knab: has "Rekeningnummer" as first column + "Transactiedatum"
  if (firstLineLower.includes('rekeningnummer') && firstLineLower.includes('transactiedatum')) {
    return 'knab'
  }

  // Triodos: CSV with standard NL headers but "Triodos" in filename
  if (fileName?.toLowerCase().includes('triodos')) {
    return 'triodos'
  }

  // Volksbank brands: detect by filename
  if (fileName) {
    const fn = fileName.toLowerCase()
    if (fn.includes('sns')) return 'sns'
    if (fn.includes('asn')) return 'asn'
    if (fn.includes('regio')) return 'regiobank'
  }

  // Rabobank CSV files are often named CSV_A_YYYYMMDD_HHMMSS
  if (fileName && /^csv_a_\d{8}/i.test(fileName)) {
    return 'rabobank'
  }

  return null
}

// ─── MAIN PARSE FUNCTION ─────────────────────────────────────────────────────

/**
 * Parse a bank transaction export file.
 *
 * @param text - Raw file content as string
 * @param bankId - Bank identifier (if known). If null, auto-detection is attempted.
 * @param fileName - Original filename (helps with auto-detection)
 */
export function parseBankExport(text: string, bankId?: BankId | null, fileName?: string): ParseResult {
  // Auto-detect if no bank specified
  const detectedBank = bankId || detectBank(text, fileName)

  if (!detectedBank) {
    return {
      bank: 'ing', // fallback
      bankLabel: 'Onbekend',
      transactions: [],
      accountNumber: '',
      period: { from: '', to: '' },
      errors: ['Kan het bankformaat niet herkennen. Selecteer je bank handmatig.'],
    }
  }

  switch (detectedBank) {
    case 'abn_amro':
      return parseAbnAmro(text)
    case 'ing':
      return parseIng(text)
    case 'rabobank':
      return parseRabobank(text)
    case 'sns':
      return parseVolksbank(text, 'sns')
    case 'asn':
      return parseVolksbank(text, 'asn')
    case 'regiobank':
      return parseVolksbank(text, 'regiobank')
    case 'knab':
      return parseKnab(text)
    case 'bunq':
      return parseBunq(text)
    case 'triodos':
      return parseTriodos(text)
    case 'kbc':
      return parseKbc(text)
    case 'bnp_paribas_fortis':
      return parseBnpParibasFortis(text)
    case 'belfius':
      return parseBelfius(text)
    case 'argenta':
      return parseArgenta(text)
    default:
      return {
        bank: detectedBank,
        bankLabel: BANK_LABELS[detectedBank] || 'Onbekend',
        transactions: [],
        accountNumber: '',
        period: { from: '', to: '' },
        errors: [`Parser voor ${BANK_LABELS[detectedBank] || detectedBank} is nog niet beschikbaar`],
      }
  }
}

// Re-export utilities for the API routes
export { makeExternalId }