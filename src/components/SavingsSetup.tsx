// src/components/SavingsSetup.tsx
'use client'

import { useState, useEffect } from 'react'

interface DetectedSavings {
  iban: string
  name: string
  monthlyAmount: number
}

interface SavingsAccount {
  iban: string
  name: string
  balance: string
  detected: boolean
}

interface Props {
  onComplete: () => void
}

export default function SavingsSetup({ onComplete }: Props) {
  const [detected, setDetected] = useState<DetectedSavings[]>([])
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    detectSavingsTransfers()
  }, [])

  async function detectSavingsTransfers() {
    try {
      const res = await fetch('/api/savings/detect')
      if (!res.ok) throw new Error()
      const data = await res.json()

      const detectedAccounts: DetectedSavings[] = data.savings ?? []
      setDetected(detectedAccounts)

      setAccounts(detectedAccounts.map(d => ({
        iban: d.iban,
        name: d.name,
        balance: '',
        detected: true,
      })))
    } catch {
      setAccounts([{ iban: '', name: 'Mijn spaarrekening', balance: '', detected: false }])
    } finally {
      setLoading(false)
    }
  }

  function addAccount() {
    setAccounts(prev => [...prev, { iban: '', name: 'Spaarrekening', balance: '', detected: false }])
  }

  function removeAccount(index: number) {
    setAccounts(prev => prev.filter((_, i) => i !== index))
  }

  function updateAccount(index: number, field: keyof SavingsAccount, value: string) {
    setAccounts(prev => prev.map((acc, i) => i === index ? { ...acc, [field]: value } : acc))
  }

  async function handleSave() {
    setError('')
    const toSave = accounts.filter(a => {
      const val = Number(a.balance)
      return Number.isFinite(val) && val >= 0
    })

    if (toSave.length === 0) {
      onComplete()
      return
    }

    setSaving(true)
    try {
      await Promise.all(toSave.map(acc =>
        fetch('/api/accounts/savings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: acc.name,
            balance: Number(acc.balance),
            iban: acc.iban || null,
          }),
        })
      ))
      onComplete()
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  const totalMonthly = detected.reduce((s, d) => s + d.monthlyAmount, 0)

  if (loading) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent mx-auto mb-3 animate-spin"
          style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Spaarrekeningen detecteren...</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>
          Wat staat er op je spaarrekening?
        </p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Je bank geeft geen saldo van spaarrekeningen vrij via PSD2. Vul je spaarsaldo handmatig in — je kunt dit altijd later bijwerken.
        </p>
      </div>

      {/* Gedetecteerde spaaroverschrijvingen */}
      {detected.length > 0 && (
        <div className="px-5 pt-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--tab-bg)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--brand)' }}>
              Fynn ziet dat je €{totalMonthly.toFixed(0)}/maand spaart
            </p>
            {detected.map((d, i) => (
              <p key={i} className="text-xs" style={{ color: 'var(--muted)' }}>
                → €{d.monthlyAmount.toFixed(0)}/mnd naar {d.name} ({d.iban.slice(0, 8)}...)
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Invoervelden */}
      <div className="px-5 py-5 space-y-4">
        {accounts.map((acc, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={acc.name}
                onChange={e => updateAccount(i, 'name', e.target.value)}
                placeholder="Naam spaarrekening"
                className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--tab-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
              {accounts.length > 1 && (
                <button
                  onClick={() => removeAccount(i)}
                  className="text-sm leading-none"
                  style={{ color: 'var(--muted)' }}>
                  ✕
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>
                €
              </span>
              <input
                type="number"
                value={acc.balance}
                onChange={e => updateAccount(i, 'balance', e.target.value)}
                placeholder="0,00"
                min="0"
                step="0.01"
                className="w-full rounded-xl pl-8 pr-4 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--tab-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            {!acc.detected && (
              <input
                type="text"
                value={acc.iban}
                onChange={e => updateAccount(i, 'iban', e.target.value.toUpperCase())}
                placeholder="IBAN (optioneel, bijv. NL12ABNA...)"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none font-mono"
                style={{
                  backgroundColor: 'var(--tab-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            )}
          </div>
        ))}

        <button
          onClick={addAccount}
          className="w-full py-3 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
          style={{
            border: '1px dashed var(--border)',
            color: 'var(--muted)',
          }}>
          + Extra spaarrekening toevoegen
        </button>

        {error && (
          <p className="text-xs rounded-xl p-3"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onComplete}
            className="flex-1 py-3.5 rounded-xl text-sm"
            style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)' }}>
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-30 transition-opacity"
            style={{ backgroundColor: 'var(--brand)' }}>
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          Je kunt dit later altijd aanpassen via de Sparen-tab.
        </p>
      </div>
    </div>
  )
}