// src/components/TransactionUpload.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { BankId } from '@/lib/bank-parsers'

// ─── Bank metadata for manual selection ──────────────────────────────────────

const BANKS: { id: BankId; label: string; country: 'NL' | 'BE'; format: string }[] = [
  // Nederland
  { id: 'abn_amro', label: 'ABN AMRO', country: 'NL', format: 'TAB / XLS' },
  { id: 'ing', label: 'ING', country: 'NL', format: 'CSV' },
  { id: 'rabobank', label: 'Rabobank', country: 'NL', format: 'CSV' },
  { id: 'sns', label: 'SNS Bank', country: 'NL', format: 'CSV' },
  { id: 'asn', label: 'ASN Bank', country: 'NL', format: 'CSV' },
  { id: 'regiobank', label: 'RegioBank', country: 'NL', format: 'CSV' },
  { id: 'knab', label: 'Knab', country: 'NL', format: 'CSV' },
  { id: 'bunq', label: 'bunq', country: 'NL', format: 'CSV' },
  { id: 'triodos', label: 'Triodos Bank', country: 'NL', format: 'CSV' },
  // België
  { id: 'kbc', label: 'KBC', country: 'BE', format: 'CSV' },
  { id: 'bnp_paribas_fortis', label: 'BNP Paribas Fortis', country: 'BE', format: 'CSV' },
  { id: 'belfius', label: 'Belfius', country: 'BE', format: 'CSV' },
  { id: 'argenta', label: 'Argenta', country: 'BE', format: 'CSV' },
]

// ─── Export instructions per bank ────────────────────────────────────────────

const EXPORT_INSTRUCTIONS: Partial<Record<BankId, string[]>> = {
  abn_amro: [
    'Log in op Mijn ABN AMRO via internetbankieren',
    'Ga naar "Zelf regelen" → "Bij- en afschrijvingen downloaden"',
    'Selecteer de gewenste periode (max 24 maanden)',
    'Download als TXT/TAB bestand',
  ],
  ing: [
    'Log in op Mijn ING via internetbankieren',
    'Klik op "Service" → "Af- en bijschrijvingen downloaden"',
    'Selecteer rekening en periode (max 18 maanden)',
    'Kies formaat "Kommagescheiden CSV" en download',
  ],
  rabobank: [
    'Log in op Rabo Internetbankieren',
    'Ga naar "Downloaden transacties"',
    'Kies formaat "CSV (.csv)" en de gewenste periode',
    'Klik op "Bestand downloaden"',
  ],
  sns: [
    'Log in op Mijn SNS',
    'Ga naar "Bij- en afschriften"',
    'Klik op "Downloaden" en kies CSV',
    'Selecteer de gewenste periode',
  ],
  asn: [
    'Log in bij ASN Bank',
    'Ga naar je betaalrekening',
    'Klik op "Downloaden" → kies CSV',
    'Selecteer de gewenste periode',
  ],
  bunq: [
    'Open de bunq app',
    'Ga naar het "me" scherm → selecteer rekening',
    'Tik op "+" → "Exporteer rekeningoverzicht"',
    'Kies CSV en de gewenste periode',
  ],
  kbc: [
    'Log in op KBC Online',
    'Ga naar je rekening → "Verrichtingen"',
    'Klik op "Exporteren" → kies CSV',
    'Selecteer de gewenste periode',
  ],
  bnp_paribas_fortis: [
    'Log in op Easy Banking Web',
    'Ga naar je rekening → "Rekeninguittreksels"',
    'Klik op "Downloaden" → kies CSV',
    'Selecteer de gewenste periode',
  ],
  belfius: [
    'Log in op Belfius Direct Net',
    'Ga naar "Historiek" van je rekening',
    'Klik op "Exporteren naar CSV"',
    'Selecteer de gewenste periode',
  ],
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreviewData {
  bank: BankId
  bankLabel: string
  transactionCount: number
  period: { from: string; to: string }
  accountNumber: string
  totalIncome: number
  totalOverigInkomsten?: number
  totalExpenses: number
  internalTransfers?: number
}

interface ImportResult extends PreviewData {
  inserted: number
  duplicatesSkipped: number
  failed: number
  accountId: string
}

type UploadStep = 'select' | 'uploading' | 'preview' | 'importing' | 'done' | 'error'

interface Props {
  /** Called after successful import */
  onComplete?: () => void
  /** If true, shows a more compact layout */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TransactionUpload({ onComplete, compact = false, className = '' }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<UploadStep>('select')
  const [selectedBank, setSelectedBank] = useState<BankId | null>(null)
  const [countryFilter, setCountryFilter] = useState<'NL' | 'BE'>('NL')
  const [showInstructions, setShowInstructions] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const filteredBanks = BANKS.filter(b => b.country === countryFilter)
  const currentBank = BANKS.find(b => b.id === selectedBank)
  const instructions = selectedBank ? EXPORT_INSTRUCTIONS[selectedBank] : null

  // ── File handling ──────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setUploadedFile(file)
    setError('')
    setStep('uploading')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('mode', 'preview')
    if (selectedBank) formData.append('bank', selectedBank)

    try {
      const res = await fetch('/api/upload-transactions', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        // If auto-detect failed, ask user to select bank
        if (data.error?.includes('niet herkennen') || data.error?.includes('bankformaat')) {
          setError('We konden je bank niet automatisch herkennen. Selecteer je bank hierboven en probeer opnieuw.')
          setStep('select')
          return
        }
        throw new Error(data.error || 'Upload mislukt')
      }

      setPreview(data)
      // If auto-detected a different bank than selected, update selection
      if (data.bank && data.bank !== selectedBank) {
        setSelectedBank(data.bank)
      }
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis')
      setStep('error')
    }
  }, [selectedBank])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── Import action ──────────────────────────────────────────────────

  async function handleImport() {
    if (!uploadedFile) {
      setError('Bestand niet meer beschikbaar. Upload opnieuw.')
      setStep('error')
      return
    }

    // Store file data in sessionStorage so sync page can trigger the import
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      sessionStorage.setItem('fynn_import_file', JSON.stringify({
        name: uploadedFile.name,
        type: uploadedFile.type,
        data: base64,
        bank: selectedBank || '',
      }))
      // Navigate immediately to sync page — no spinner on this page
      router.push('/sync?provider=manual')
    }
    reader.readAsDataURL(uploadedFile)
  }

  // ── Reset ──────────────────────────────────────────────────────────

  function reset() {
    setStep('select')
    setPreview(null)
    setImportResult(null)
    setError('')
    setFileName('')
    setUploadedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Formatting helpers ─────────────────────────────────────────────

  const fmtEuro = (n: number) =>
    n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  // ─── RENDER ────────────────────────────────────────────────────────

  return (
    <div className={`space-y-4 ${className}`}>

      {/* ── Step: Bank Selection + Upload ── */}
      {(step === 'select' || step === 'error') && (
        <>
          {/* Country filter */}
          <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }}>
            {(['NL', 'BE'] as const).map(c => (
              <button key={c} onClick={() => setCountryFilter(c)}
                className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: countryFilter === c ? 'var(--tab-active)' : 'transparent',
                  color: countryFilter === c ? 'var(--tab-active-text)' : 'var(--muted)',
                }}>
                {c === 'NL' ? '🇳🇱 Nederland' : '🇧🇪 België'}
              </button>
            ))}
          </div>

          {/* Bank selection grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {filteredBanks.map(bank => (
              <button
                key={bank.id}
                onClick={() => setSelectedBank(selectedBank === bank.id ? null : bank.id)}
                className="px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  backgroundColor: selectedBank === bank.id
                    ? 'color-mix(in srgb, var(--brand) 15%, var(--tab-bg))'
                    : 'var(--tab-bg)',
                  border: selectedBank === bank.id
                    ? '1px solid color-mix(in srgb, var(--brand) 40%, transparent)'
                    : '1px solid var(--border)',
                }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏦</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{
                      color: selectedBank === bank.id ? 'var(--brand)' : 'var(--text)'
                    }}>
                      {bank.label}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{bank.format}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Export instructions (collapsible) */}
          {instructions && (
            <div>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                style={{ backgroundColor: 'var(--tab-bg)', border: '1px solid var(--border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  📋 Hoe exporteer ik mijn transacties bij {currentBank?.label}?
                </span>
                <span className="text-xs" style={{ color: 'var(--muted)', transform: showInstructions ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  ▾
                </span>
              </button>
              {showInstructions && (
                <div className="mt-2 px-4 py-3 rounded-xl space-y-2" style={{ backgroundColor: 'var(--tab-bg)' }}>
                  {instructions.map((step, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-xs font-bold shrink-0" style={{ color: 'var(--brand)' }}>{i + 1}.</span>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{step}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('tx-file-input')?.click()}
            className="rounded-2xl p-8 text-center cursor-pointer transition-all"
            style={{
              backgroundColor: dragOver
                ? 'color-mix(in srgb, var(--brand) 10%, var(--surface))'
                : 'var(--surface)',
              border: dragOver
                ? '2px dashed var(--brand)'
                : '2px dashed var(--border)',
            }}>
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: 'var(--tab-bg)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--brand)' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              {dragOver ? 'Laat los om te uploaden' : 'Sleep je bankexport hierheen'}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              of klik om een bestand te kiezen · CSV, XLS, TXT
            </p>
          </div>

          <input
            id="tx-file-input"
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx,.txt,.tab"
            onChange={handleFileInput}
            className="hidden"
          />

          {/* Error message */}
          {error && (
            <div className="rounded-xl px-4 py-3"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>
              {step === 'error' && (
                <button onClick={reset} className="text-xs font-medium mt-2 underline" style={{ color: '#EF4444' }}>
                  Opnieuw proberen
                </button>
              )}
            </div>
          )}

          {/* Security note */}
          {!compact && (
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--tab-bg)' }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                🔒 Je bestand wordt verwerkt en direct verwijderd — we slaan alleen de transactiegegevens op in je beveiligde Fynn-account.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Step: Uploading / Parsing ── */}
      {step === 'uploading' && (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent mx-auto mb-3"
            style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Bestand wordt geanalyseerd...</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{fileName}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === 'preview' && preview && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* Preview header */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 15%, var(--tab-bg))' }}>
                  <span className="text-sm">✅</span>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {preview.transactionCount} transacties gevonden
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {preview.bankLabel} {preview.accountNumber && `· ${preview.accountNumber.slice(-8)}`}
                  </p>
                </div>
              </div>
              <button onClick={reset} className="text-xs" style={{ color: 'var(--muted)' }}>✕</button>
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Periode</span>
              <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text)' }}>
                {formatDate(preview.period.from)} — {formatDate(preview.period.to)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Totaal inkomen</span>
              <span className="text-xs font-medium tabular-nums" style={{ color: '#4ade80' }}>
                + €{fmtEuro(preview.totalIncome)}
              </span>
            </div>
            {(preview.totalOverigInkomsten ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Overige inkomsten</span>
                <span className="text-xs font-medium tabular-nums" style={{ color: '#86efac' }}>
                  + €{fmtEuro(preview.totalOverigInkomsten!)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Totaal uitgaven</span>
              <span className="text-xs font-medium tabular-nums" style={{ color: '#EF4444' }}>
                − €{fmtEuro(preview.totalExpenses)}
              </span>
            </div>
            {(preview.internalTransfers ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Interne overboekingen</span>
                <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--muted)' }}>
                  {preview.internalTransfers}× uitgefilterd
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={reset}
              className="flex-1 py-3 rounded-xl text-xs font-medium transition-all"
              style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              Annuleren
            </button>
            <button
              onClick={handleImport}
              className="flex-1 py-3 rounded-xl text-xs font-semibold text-white transition-all"
              style={{ backgroundColor: 'var(--brand)' }}>
              Importeren
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Importing ── */}
      {step === 'importing' && (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent mx-auto mb-3"
            style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Transacties worden geïmporteerd...
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Categoriseren en vaste lasten detecteren
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === 'done' && importResult && (
        <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 15%, var(--tab-bg))' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--brand)' }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
            {importResult.inserted} transacties geïmporteerd
          </p>
          <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
            {importResult.bankLabel} · {formatDate(importResult.period.from)} — {formatDate(importResult.period.to)}
          </p>
          {importResult.duplicatesSkipped > 0 && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {importResult.duplicatesSkipped} duplicaten overgeslagen
            </p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={reset}
              className="flex-1 py-3 rounded-xl text-xs font-medium transition-all"
              style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              Nog een bestand
            </button>
            <button
              onClick={() => { router.push('/dashboard'); onComplete?.() }}
              className="flex-1 py-3 rounded-xl text-xs font-semibold text-white transition-all"
              style={{ backgroundColor: 'var(--brand)' }}>
              Naar dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}