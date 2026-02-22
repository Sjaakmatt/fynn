'use client'

import { useState } from 'react'

export default function UitgaveCheck() {
  const [bedrag, setBedrag] = useState('')
  const [omschrijving, setOmschrijving] = useState('')
  const [advies, setAdvies] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPositief, setIsPositief] = useState(false)

  async function handleCheck() {
    if (!bedrag || loading) return
    setLoading(true)
    setAdvies('')
    try {
      const response = await fetch('/api/ai/uitgave-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedrag: parseFloat(bedrag), omschrijving }),
      })
      const data = await response.json()
      if (data.advies) {
        setAdvies(data.advies)
        setIsPositief(data.advies.toLowerCase().startsWith('ja'))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Uitgave Check</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Kan ik dit betalen?</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative w-28">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>€</span>
            <input
              type="number"
              value={bedrag}
              onChange={e => setBedrag(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl pl-7 pr-3 py-3 text-sm outline-none"
              style={{ 
                backgroundColor: 'var(--tab-bg)', 
                color: 'var(--text)',
                border: '1px solid var(--border)'
              }}
            />
          </div>
          <input
            type="text"
            value={omschrijving}
            onChange={e => setOmschrijving(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
            placeholder="Waarvoor?"
            className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
            style={{ 
              backgroundColor: 'var(--tab-bg)', 
              color: 'var(--text)',
              border: '1px solid var(--border)'
            }}
          />
          <button
            onClick={handleCheck}
            disabled={loading || !bedrag}
            className="px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--brand)', color: '#FFFFFF' }}
          >
            {loading ? '...' : 'Check'}
          </button>
        </div>

        {advies && (
          <div
            className="rounded-xl p-4 text-sm leading-relaxed"
            style={{
              backgroundColor: isPositief ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${isPositief ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: 'var(--text)'
            }}
          >
            {advies}
          </div>
        )}
      </div>
    </div>
  )
}