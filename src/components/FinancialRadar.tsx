'use client'

import { useEffect, useState } from 'react'

interface Projection {
  projectedFreeSpace: number
  salaryExpected: number
  salaryDate: number
  fixedExpensesThisMonth: number
  stillToPay: number
  daysUntilSalary: number
  riskLevel: 'safe' | 'caution' | 'danger'
  signals: Signal[]
}

interface Signal {
  type: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'danger'
  amount?: number
}

interface RecurringItem {
  description: string
  amount: number
  category: string
  dayOfMonth: number
  confidence: number
}

const SEVERITY_COLORS = {
  info: { bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)', icon: '💡' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '⚠️' },
  danger: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: '🚨' },
}

const RISK_CONFIG = {
  safe: { color: '#4ADE80', label: 'Op koers', icon: '✓' },
  caution: { color: '#F59E0B', label: 'Let op', icon: '!' },
  danger: { color: '#EF4444', label: 'Actie vereist', icon: '✕' },
}

export default function FinancialRadar() {
  const [projection, setProjection] = useState<Projection | null>(null)
  const [recurring, setRecurring] = useState<RecurringItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showRecurring, setShowRecurring] = useState(false)

  useEffect(() => {
    fetch('/api/engine')
      .then(r => r.json())
      .then(data => {
        if (data.projection) setProjection(data.projection)
        if (data.recurring) setRecurring(data.recurring)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="rounded-2xl p-5 animate-pulse"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="h-4 w-32 rounded mb-3" style={{ backgroundColor: 'var(--tab-bg)' }} />
      <div className="h-8 w-48 rounded" style={{ backgroundColor: 'var(--tab-bg)' }} />
    </div>
  )

  if (!projection) return null

  const risk = RISK_CONFIG[projection.riskLevel]

  return (
    <div className="space-y-3">
      {/* Cashflow projectie card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                Cashflow Radar
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Projectie komende 30 dagen
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${risk.color}18`, color: risk.color }}>
              <span>{risk.icon}</span>
              <span>{risk.label}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          {/* Vrije ruimte groot */}
          <div className="mb-4">
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
              Vrije ruimte deze maand
            </p>
            <p className="text-4xl font-bold" style={{
              color: projection.projectedFreeSpace < 0 ? '#EF4444'
                : projection.projectedFreeSpace < 200 ? '#F59E0B'
                : 'var(--text)'
            }}>
              €{projection.projectedFreeSpace.toFixed(0)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              na vaste lasten van €{projection.fixedExpensesThisMonth.toFixed(0)}/maand
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--tab-bg)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Salaris</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                dag {projection.salaryDate}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                over {projection.daysUntilSalary}d
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--tab-bg)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Nog te betalen</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                €{projection.stillToPay.toFixed(0)}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>vaste lasten</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--tab-bg)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Inkomen</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                €{projection.salaryExpected.toFixed(0)}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>gemiddeld</p>
            </div>
          </div>
        </div>

        {/* Vaste lasten toggle */}
        {recurring.length > 0 && (
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setShowRecurring(!showRecurring)}
              className="w-full px-5 py-3 text-left flex items-center justify-between text-xs transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              <span>{recurring.length} vaste lasten gedetecteerd</span>
              <span>{showRecurring ? '▲' : '▼'}</span>
            </button>
            {showRecurring && (
              <div className="px-5 pb-4 space-y-2">
                {recurring.slice(0, 8).map(item => (
                  <div key={item.description} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>
                        {item.description}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        Elke maand ~dag {item.dayOfMonth}
                      </p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      €{item.amount.toFixed(0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Signalen */}
      {projection.signals.length > 0 && (
        <div className="space-y-2">
          {projection.signals.map((signal, i) => {
            const config = SEVERITY_COLORS[signal.severity]
            return (
              <div key={i} className="rounded-2xl px-4 py-3 flex items-start gap-3"
                style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}>
                <span className="text-base mt-0.5">{config.icon}</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {signal.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {signal.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}