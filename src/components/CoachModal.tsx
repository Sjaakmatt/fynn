'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ChatCoach from './ChatCoach'
import UitgaveCheck from './UitgaveCheck'
import AFMDisclaimer from './AFMDisclaimer'

type ActiveView = 'coach' | 'check'

interface Props {
  isPro: boolean
}

export default function CoachModal({ isPro }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<ActiveView>('coach')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Vergrendel body scroll als modal open is
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!mounted) return null

  return createPortal(
    <>
      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm text-white shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          bottom: 24,
          right: 20,
          backgroundColor: 'var(--brand)',
          boxShadow: '0 4px 24px rgba(26,58,42,0.5)',
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span>
        Vraag Fynn
      </button>

      {/* ── Modal overlay ── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[150]"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          />

          {/* Bottom sheet */}
          <div
            className="fixed z-[160] flex flex-col"
            style={{
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '90vh',
              backgroundColor: 'var(--bg)',
              borderRadius: '20px 20px 0 0',
              borderTop: '1px solid var(--border)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            {/* Header met toggle */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Toggle switch: Coach ↔ Check */}
              <div
                className="flex p-1 rounded-xl"
                style={{ backgroundColor: 'var(--tab-bg)' }}
              >
                <button
                  onClick={() => setView('coach')}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: view === 'coach' ? 'var(--tab-active)' : 'transparent',
                    color: view === 'coach' ? 'var(--tab-active-text)' : 'var(--muted)',
                  }}
                >
                  ✦ Coach
                </button>
                <button
                  onClick={() => setView('check')}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: view === 'check' ? 'var(--tab-active)' : 'transparent',
                    color: view === 'check' ? 'var(--tab-active-text)' : 'var(--muted)',
                  }}
                >
                  ✓ Check
                </button>
              </div>

              {/* Sluit knop */}
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-sm"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {isPro ? (
                <>
                  {view === 'coach' && (
                    <div className="max-w-2xl mx-auto">
                      <ChatCoach />
                      <AFMDisclaimer />
                    </div>
                  )}
                  {view === 'check' && (
                    <div className="max-w-2xl mx-auto">
                      <UitgaveCheck />
                      <AFMDisclaimer />
                    </div>
                  )}
                </>
              ) : (
                /* Free users — upgrade nudge */
                <div className="max-w-2xl mx-auto py-8 text-center">
                  <p className="text-4xl mb-4">✦</p>
                  <p className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>
                    Fynn Coach is Pro
                  </p>
                  <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                    Stel Fynn vragen over je financiën en check of je iets kunt betalen — op basis van je échte bankdata.
                  </p>
                  <button
                    className="px-6 py-3 rounded-2xl text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    Upgrade naar Pro
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  )
}