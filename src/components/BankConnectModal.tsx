'use client'

import { useState } from 'react'

const NL_BE_BANKS = [
  { name: 'ABN AMRO', country: 'NL' },
  { name: 'ING', country: 'NL' },
  { name: 'Rabobank', country: 'NL' },
  { name: 'SNS Bank', country: 'NL' },
  { name: 'ASN Bank', country: 'NL' },
  { name: 'RegioBank', country: 'NL' },
  { name: 'Triodos Bank', country: 'NL' },
  { name: 'Knab', country: 'NL' },
  { name: 'Bunq', country: 'NL' },
  { name: 'KBC', country: 'BE' },
  { name: 'BNP Paribas Fortis', country: 'BE' },
  { name: 'ING', country: 'BE' },
  { name: 'Belfius', country: 'BE' },
]

interface Props {
  onClose: () => void
}

export default function BankConnectModal({ onClose }: Props) {
  const [filter, setFilter] = useState<'NL' | 'BE'>('NL')
  const [loading, setLoading] = useState<string | null>(null)

  const banks = NL_BE_BANKS.filter(b => b.country === filter)

  function connect(bank: { name: string; country: string }) {
    setLoading(bank.name)
    window.location.href = `/api/enablebanking/connect?bank=${encodeURIComponent(bank.name)}&country=${bank.country}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              Koppel je bank
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Alleen lees-toegang via PSD2
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}>
            ✕
          </button>
        </div>

        {/* Land filter */}
        <div className="flex gap-1 p-1 rounded-lg mb-4" style={{ backgroundColor: 'var(--tab-bg)' }}>
          {(['NL', 'BE'] as const).map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: filter === c ? 'var(--tab-active)' : 'transparent',
                color: filter === c ? 'var(--tab-active-text)' : 'var(--muted)',
              }}>
              {c === 'NL' ? '🇳🇱 Nederland' : '🇧🇪 België'}
            </button>
          ))}
        </div>

        {/* Banken lijst */}
        <div className="space-y-1 mb-5">
          {banks.map(bank => (
            <button key={`${bank.name}-${bank.country}`}
              onClick={() => connect(bank)}
              disabled={loading !== null}
              className="w-full px-4 py-3 rounded-xl flex items-center justify-between transition-all"
              style={{
                backgroundColor: loading === bank.name ? 'rgba(26,58,42,0.35)' : 'var(--tab-bg)',
                border: '1px solid var(--border)',
                opacity: loading !== null && loading !== bank.name ? 0.5 : 1,
              }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: 'var(--surface)' }}>
                  🏦
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {bank.name}
                </span>
              </div>
              {loading === bank.name
                ? <span className="text-xs" style={{ color: 'var(--brand)' }}>Verbinden...</span>
                : <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
              }
            </button>
          ))}
        </div>

        {/* Security note */}
        <div className="rounded-xl p-3"
          style={{ backgroundColor: 'rgba(26,58,42,0.15)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            🔒 Fynn leest alleen mee — we schrijven nooit naar je rekening. Je bankgegevens worden beveiligd opgeslagen via PSD2.
          </p>
        </div>
      </div>
    </div>
  )
}