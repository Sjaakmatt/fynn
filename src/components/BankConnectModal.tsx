// src/components/BankConnectModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import TransactionUpload from './TransactionUpload'
import PlaidLinkButton from '@/components/plaid/PlaidLinkButton'

const BANKING_PROVIDER = process.env.NEXT_PUBLIC_BANKING_PROVIDER ?? 'plaid'

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
  /** Start directly on the upload tab */
  defaultTab?: 'connect' | 'upload'
}

export default function BankConnectModal({ onClose, defaultTab = 'connect' }: Props) {
  const [tab, setTab] = useState<'connect' | 'upload'>(defaultTab)
  const [filter, setFilter] = useState<'NL' | 'BE'>('NL')
  const [loading, setLoading] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const banks = NL_BE_BANKS.filter(b => b.country === filter)

  useEffect(() => { setMounted(true) }, [])

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Escape handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function connectEB(bank: { name: string; country: string }) {
    setLoading(bank.name)
    window.location.href = `/api/enablebanking/connect?bank=${encodeURIComponent(bank.name)}&country=${bank.country}`
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ backgroundColor: 'var(--bg)', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle — mobiel only */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Rekening toevoegen
            </p>
            <p className="text-lg font-semibold mt-1" style={{ color: 'var(--text)' }}>
              {tab === 'connect' ? 'Koppel je bank' : 'Upload bankexport'}
            </p>
          </div>
          <button onClick={onClose} className="mt-1 text-lg leading-none" style={{ color: 'var(--muted)' }}>
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pb-4">
          <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }}>
            <button
              onClick={() => setTab('connect')}
              className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: tab === 'connect' ? 'var(--tab-active)' : 'transparent',
                color: tab === 'connect' ? 'var(--tab-active-text)' : 'var(--muted)',
              }}>
              🔗 Automatisch
            </button>
            <button
              onClick={() => setTab('upload')}
              className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: tab === 'upload' ? 'var(--tab-active)' : 'transparent',
                color: tab === 'upload' ? 'var(--tab-active-text)' : 'var(--muted)',
              }}>
              📄 Upload bestand
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">

          {/* ── TAB: Automatic connection ── */}
          {tab === 'connect' && (
            <div className="space-y-4">

              {/* Provider: Plaid */}
              {BANKING_PROVIDER === 'plaid' && (
                <div className="space-y-5">
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    Selecteer je bank en log veilig in via Plaid.
                  </p>
                  <PlaidLinkButton
                    onSuccess={onClose}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: 'var(--brand)',
                      color: 'white',
                    }}
                  >
                    Bank koppelen
                  </PlaidLinkButton>
                </div>
              )}

              {/* Provider: Enable Banking */}
              {BANKING_PROVIDER === 'enablebanking' && (
                <>
                  {/* Land filter */}
                  <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }}>
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
                  <div className="space-y-1.5">
                    {banks.map(bank => (
                      <button key={`${bank.name}-${bank.country}`}
                        onClick={() => connectEB(bank)}
                        disabled={loading !== null}
                        className="w-full px-4 py-3 rounded-xl flex items-center justify-between transition-all"
                        style={{
                          backgroundColor: loading === bank.name
                            ? 'color-mix(in srgb, var(--brand) 15%, var(--tab-bg))'
                            : 'var(--tab-bg)',
                          border: '1px solid var(--border)',
                          opacity: loading !== null && loading !== bank.name ? 0.4 : 1,
                        }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
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
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--tab-bg)' }}>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                      🔒 Fynn leest alleen mee — we schrijven nooit naar je rekening. Beveiligd via PSD2, alleen lees-toegang.
                    </p>
                  </div>
                </>
              )}

              {/* Switch to upload hint */}
              <button
                onClick={() => setTab('upload')}
                className="w-full text-center text-xs py-2 transition-opacity hover:opacity-80"
                style={{ color: 'var(--muted)' }}>
                Liever een CSV uploaden? →
              </button>
            </div>
          )}

          {/* ── TAB: Manual upload ── */}
          {tab === 'upload' && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Download je transacties als CSV vanuit je bank en upload het bestand hieronder.
                Fynn herkent automatisch welke bank het is.
              </p>

              <TransactionUpload
                compact
                onComplete={onClose}
              />

              {/* Switch to connect hint */}
              <button
                onClick={() => setTab('connect')}
                className="w-full text-center text-xs py-2 transition-opacity hover:opacity-80"
                style={{ color: 'var(--muted)' }}>
                ← Liever automatisch koppelen via PSD2?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}