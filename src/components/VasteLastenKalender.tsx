'use client'

import { useEffect, useState } from 'react'
import { cleanDescription } from '@/lib/clean-description'

interface CalendarItem {
  name: string
  amount: number
  nextDate: string
  thisMonthDate: string
  dayOfMonth: number
  daysUntil: number
  isPast: boolean
  warning: boolean
}

function daysLabel(days: number): string {
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  if (days === 2) return 'Overmorgen'
  if (days < 0) return '✓ Betaald deze maand'
  return `Over ${days} dagen`
}

export default function VasteLastenKalender() {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'lijst' | 'kalender'>('lijst')
  const [balanceWarning, setBalanceWarning] = useState(false)
  const [upcomingTotal, setUpcomingTotal] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then(d => {
        const sorted = (d.items ?? []).sort((a: CalendarItem, b: CalendarItem) => a.dayOfMonth - b.dayOfMonth)
        setItems(sorted)
        setBalanceWarning(d.balanceWarning ?? false)
        setUpcomingTotal(d.upcomingTotal ?? 0)
        setTotalBalance(d.totalBalance ?? 0)
        setLoading(false)
      })
  }, [])

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const monthName = today.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })

  const byDay: Record<number, CalendarItem[]> = {}
  items.forEach(item => {
    const d = new Date(item.thisMonthDate)
    if (d.getMonth() === month && d.getFullYear() === year) {
      if (!byDay[d.getDate()]) byDay[d.getDate()] = []
      byDay[d.getDate()].push(item)
    }
  })

  const totalThisMonth = items.reduce((sum, i) => sum + i.amount, 0)
  const warnings = items.filter(i => i.warning)

  if (loading) return (
    <div className="rounded-2xl p-8 flex items-center justify-center"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
    </div>
  )

  if (items.length === 0) return (
    <div className="rounded-2xl p-8 text-center"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-3xl mb-3">📅</p>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Nog geen vaste lasten gevonden</p>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>Fynn detecteert vaste lasten automatisch zodra er genoeg transactiehistorie is.</p>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm capitalize" style={{ color: 'var(--text)' }}>
              Vaste lasten — {monthName}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {items.length} terugkerende betalingen · €{totalThisMonth.toFixed(0)} totaal
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }}>
            {(['lijst', 'kalender'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all capitalize"
                style={{
                  backgroundColor: view === v ? 'var(--tab-active)' : 'transparent',
                  color: view === v ? 'var(--tab-active-text)' : 'var(--muted)',
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Saldo waarschuwing */}
        {balanceWarning && (
          <div className="rounded-xl p-3 mb-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>
              ⚠️ Mogelijk tekort
            </p>
            <p className="text-xs" style={{ color: '#EF4444' }}>
              Komende betalingen (€{upcomingTotal.toFixed(0)}) overschrijden je saldo (€{totalBalance.toFixed(0)})
            </p>
          </div>
        )}

        {/* Betalingen binnen 3 dagen */}
        {warnings.length > 0 && (
          <div className="rounded-xl p-3 mb-1"
            style={{
              backgroundColor: balanceWarning ? 'rgba(239,68,68,0.08)' : 'rgba(26,58,42,0.15)',
              border: `1px solid ${balanceWarning ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.2)'}`,
            }}>
            <p className="text-xs font-semibold mb-2"
              style={{ color: balanceWarning ? '#EF4444' : '#4ade80' }}>
              {balanceWarning ? '⚠️' : '📅'} Komt eraan (binnen 3 dagen)
            </p>
            {warnings.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-xs" style={{ color: balanceWarning ? '#EF4444' : '#4ade80' }}>
                  {item.name} — {daysLabel(item.daysUntil).toLowerCase()}
                </p>
                <p className="text-xs font-semibold" style={{ color: balanceWarning ? '#EF4444' : '#4ade80' }}>
                  €{item.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIJST VIEW */}
      {view === 'lijst' && (
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {items.map((item, i) => {
            const date = new Date(item.thisMonthDate)
            const itemColor = item.warning
              ? balanceWarning ? '#EF4444' : '#4ade80'
              : 'var(--muted)'
            return (
              <div key={i} className="px-5 py-4 flex items-center justify-between"
                style={{
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: item.isPast ? 0.65 : 1,
                }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: item.warning
                        ? balanceWarning ? 'rgba(239,68,68,0.15)' : 'rgba(26,58,42,0.25)'
                        : item.isPast
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(26,58,42,0.25)',
                    }}>
                    <p className="text-xs font-bold leading-none"
                      style={{ color: item.warning ? itemColor : 'var(--text)' }}>
                      {date.getDate()}
                    </p>
                    <p className="text-xs leading-none mt-0.5"
                      style={{ color: item.warning ? itemColor : 'var(--muted)' }}>
                      {date.toLocaleDateString('nl-NL', { month: 'short' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                     {cleanDescription(item.name)}
                     </p>
                    <p className="text-xs" style={{ color: itemColor }}>
                      {item.isPast
                        ? '✓ Betaald deze maand'
                        : item.warning
                        ? `${balanceWarning ? '⚠️' : '📅'} ${daysLabel(item.daysUntil)}`
                        : daysLabel(item.daysUntil)}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  €{item.amount.toFixed(2)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* KALENDER VIEW */}
      {view === 'kalender' && (
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
            {['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium"
                style={{ color: 'var(--muted)' }}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square p-1"
                style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isToday = day === today.getDate()
              const dayItems = byDay[day] ?? []
              const hasWarning = dayItems.some(item => item.warning)
              const col = (firstDayOfMonth + day - 1) % 7
              const flipTooltip = col >= 5 // vrijdag en zaterdag → tooltip naar links

              return (
                <div key={day}
                  className="aspect-square p-1 flex flex-col overflow-visible relative"
                  style={{
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: hasWarning && balanceWarning
                      ? 'rgba(239,68,68,0.05)'
                      : isToday ? 'var(--tab-bg)' : 'transparent',
                  }}>
                  <p className="text-xs font-medium leading-none mb-1"
                    style={{
                      color: isToday ? 'var(--brand)' : 'var(--text)',
                      fontWeight: isToday ? 700 : 400,
                    }}>
                    {day}
                  </p>
                  {dayItems.map((item, j) => {
                    const isRed = item.warning && balanceWarning
                    const itemBg = isRed
                      ? 'rgba(239,68,68,0.15)'
                      : item.isPast
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(26,58,42,0.35)'
                    const itemColor = isRed
                      ? '#EF4444'
                      : item.isPast
                      ? 'rgba(255,255,255,0.55)'
                      : '#4ade80'

                    return (
                      <div key={j}
                        className="group relative rounded px-1 leading-tight mb-0.5 cursor-pointer"
                        style={{ backgroundColor: itemBg, fontSize: 9 }}>
                        <p className="truncate font-medium" style={{ color: itemColor }}>
                          {item.name.split(' ')[0]}
                        </p>
                        <p style={{ color: itemColor, opacity: 0.8 }}>
                          €{item.amount.toFixed(0)}
                        </p>

                        {/* Hover tooltip — gespiegeld aan de rechterkant */}
                        <div
                          className="absolute bottom-full z-50 mb-1 hidden group-hover:block"
                          style={{
                            minWidth: 180,
                            left: flipTooltip ? 'auto' : 0,
                            right: flipTooltip ? 0 : 'auto',
                          }}>
                          <div className="rounded-xl p-3 shadow-lg"
                            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                              {item.name}
                            </p>
                            <p className="text-sm font-bold mb-1" style={{ color: itemColor }}>
                              €{item.amount.toFixed(2)}
                            </p>
                            <div className="h-px mb-2" style={{ backgroundColor: 'var(--border)' }} />
                            <p className="text-xs" style={{ color: itemColor }}>
                              {item.isPast
                                ? '✓ Betaald deze maand'
                                : `${isRed ? '⚠️' : '📅'} ${daysLabel(item.daysUntil)}`}
                            </p>
                            {isRed && (
                              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                                Mogelijk onvoldoende saldo
                              </p>
                            )}
                            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                              🔄 Terugkerend · maandelijks
                            </p>
                          </div>
                          {/* Pijltje */}
                          <div className="w-2 h-2 rotate-45"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderRight: '1px solid var(--border)',
                              borderBottom: '1px solid var(--border)',
                              marginTop: -5,
                              marginLeft: flipTooltip ? 'auto' : 8,
                              marginRight: flipTooltip ? 8 : 'auto',
                            }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          <div className="px-4 py-3 flex items-center gap-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(74,222,128,0.35)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Vaste last</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Tekort</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Betaald</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}