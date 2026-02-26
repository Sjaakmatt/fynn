'use client'

import { useEffect, useState } from 'react'

interface ScoreData {
  score: number
  label: string
  color: string
  breakdown: {
    sparen: number
    abonnementen: number
    uitgaven: number
    diversiteit: number
  }
  stats: {
    spaarquote: string
    aboPct: string
    uitgavenRatio: string
  }
}

export default function HealthScore() {
  const [data, setData] = useState<ScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/score')
      .then(r => r.json())
      .then(d => {
        if (d.score !== null) setData(d)
        setLoading(false)
      })
  }, [])

  function shareScore() {
    const text = `Mijn financiële gezondheidscore op Fynn: ${data?.score}/100 — ${data?.label} 💰\n\nProbeer het zelf: meetfynn.nl`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !data) return null

  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (data.score / 100) * circumference

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Financiële Gezondheidscore
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          Gebaseerd op je spaargedrag, abonnementen en uitgavenpatroon
        </p>
      </div>

      <div className="px-5 py-6">
        {/* Score cirkel */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke="var(--tab-bg)"
                strokeWidth="8"
              />
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke={data.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold" style={{ color: data.color }}>
                {data.score}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>/100</p>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>
              {data.label}
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--muted)' }}>Spaarquote</span>
                <span style={{ color: 'var(--text)' }}>{data.stats.spaarquote}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--muted)' }}>Abonnementslast</span>
                <span style={{ color: 'var(--text)' }}>{data.stats.aboPct}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--muted)' }}>Uitgaven/inkomen</span>
                <span style={{ color: 'var(--text)' }}>{data.stats.uitgavenRatio}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-2 mb-5">
          {[
            { label: 'Spaargedrag', score: data.breakdown.sparen, max: 30 },
            { label: 'Abonnementen', score: data.breakdown.abonnementen, max: 20 },
            { label: 'Uitgavendiscipline', score: data.breakdown.uitgaven, max: 30 },
            { label: 'Vermogensopbouw', score: data.breakdown.diversiteit, max: 20 },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                <span style={{ color: 'var(--text)' }}>{item.score}/{item.max}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--tab-bg)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(item.score / item.max) * 100}%`,
                    backgroundColor: data.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Deel knop */}
        <button
          onClick={shareScore}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            backgroundColor: copied ? 'rgba(74,222,128,0.15)' : 'var(--tab-bg)',
            color: copied ? '#4ADE80' : 'var(--text)',
            border: '1px solid var(--border)'
          }}
        >
          {copied ? '✓ Gekopieerd!' : '↗ Deel mijn score'}
        </button>
      </div>
    </div>
  )
}
