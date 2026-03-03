'use client'

// src/app/sync/page.tsx

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Step {
  id: string
  label: string
  sublabel: string
  status: 'waiting' | 'active' | 'done' | 'error'
}

const INITIAL_STEPS: Step[] = [
  {
    id: 'transactions',
    label: 'Transacties ophalen',
    sublabel: 'We laden je transacties van het afgelopen jaar',
    status: 'waiting',
  },
  {
    id: 'categorize',
    label: 'Categoriseren',
    sublabel: 'AI herkent boodschappen, huur, abonnementen en meer',
    status: 'waiting',
  },
  {
    id: 'recurring',
    label: 'Vaste lasten detecteren',
    sublabel: 'We zoeken je maandelijkse patronen en inkomen',
    status: 'waiting',
  },
  {
    id: 'dashboard',
    label: 'Dashboard klaarzetten',
    sublabel: 'Je kalender, budget en score worden opgebouwd',
    status: 'waiting',
  },
]

function SyncContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [currentStep, setCurrentStep] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const hasStarted = useRef(false)

  function setStepStatus(id: string, status: Step['status']) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    runSync()
  }, [])

  async function runSync() {
    try {
      // Stap 1: Transacties ophalen
      setStepStatus('transactions', 'active')
      setCurrentStep(0)
      const provider = searchParams.get('provider')

      const txRes = provider === 'enablebanking'
        ? await fetch('/api/enablebanking/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'merge' }),
          })
        : await fetch('/api/sync/transactions', { method: 'POST' })

      if (!txRes.ok) throw new Error('Transacties ophalen mislukt')
      setStepStatus('transactions', 'done')

      // Stap 2: Categoriseren
      setStepStatus('categorize', 'active')
      setCurrentStep(1)
      await fetch('/api/categorize', { method: 'POST' })
      setStepStatus('categorize', 'done')

      // Stap 3: Vaste lasten detecteren
      setStepStatus('recurring', 'active')
      setCurrentStep(2)
      const recRes = await fetch("/api/sync/recurring", { method: "POST" });
      if (!recRes.ok) throw new Error("Recurring detect mislukt");
      setStepStatus('recurring', 'done')

      // Stap 4: Dashboard klaarzetten (kleine delay voor gevoel van afronding)
      setStepStatus('dashboard', 'active')
      setCurrentStep(3)
      await new Promise(r => setTimeout(r, 1200))
      setStepStatus('dashboard', 'done')

      // Klaar!
      setDone(true)
      setTimeout(() => router.push('/dashboard?connected=true'), 1500)

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Er ging iets mis'
      setError(msg)
      // Zet actieve stap op error
      setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s))
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0f0d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 0.4; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes check-draw {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes done-scale {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        .step-row {
          animation: fade-in-up 0.4s ease forwards;
        }
        .shimmer-text {
          background: linear-gradient(90deg, #4ade80 0%, #86efac 40%, #4ade80 60%, #166534 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 2s linear infinite;
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            width: '52px', height: '52px',
            backgroundColor: '#1a5c3a',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 40px rgba(74,222,128,0.2)',
          }}>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '22px', fontFamily: "'DM Sans', sans-serif" }}>F</span>
          </div>

          {done ? (
            <div style={{ animation: 'fade-in-up 0.5s ease forwards' }}>
              <h1 style={{
                fontSize: '22px', fontWeight: 600, color: '#f0fdf4',
                margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif",
              }}>
                Fynn is klaar 🎉
              </h1>
              <p style={{ fontSize: '14px', color: '#4ade80', margin: 0 }}>
                Je wordt doorgestuurd naar je dashboard
              </p>
            </div>
          ) : error ? (
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#fca5a5', margin: '0 0 8px' }}>
                Er ging iets mis
              </h1>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{error}</p>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  marginTop: '16px', padding: '10px 20px',
                  backgroundColor: '#1a5c3a', color: 'white',
                  border: 'none', borderRadius: '10px',
                  fontSize: '13px', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                Toch naar dashboard →
              </button>
            </div>
          ) : (
            <div>
              <h1 style={{
                fontSize: '22px', fontWeight: 600, color: '#f0fdf4',
                margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif",
              }}>
                Fynn analyseert je financiën
              </h1>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                Dit duurt ongeveer 15 seconden
              </p>
            </div>
          )}
        </div>

        {/* Stappen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {steps.map((step, i) => (
            <StepRow key={step.id} step={step} index={i} />
          ))}
        </div>

        {/* Progress bar */}
        {!done && !error && (
          <div style={{ marginTop: '32px' }}>
            <div style={{
              height: '2px',
              backgroundColor: '#1a2e1f',
              borderRadius: '99px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                backgroundColor: '#4ade80',
                borderRadius: '99px',
                width: `${((currentStep) / steps.length) * 100}%`,
                transition: 'width 0.6s ease',
                boxShadow: '0 0 8px rgba(74,222,128,0.6)',
              }} />
            </div>
            <p style={{
              textAlign: 'center', marginTop: '12px',
              fontSize: '12px', color: '#374151',
              fontFamily: "'DM Mono', monospace",
            }}>
              {currentStep}/{steps.length} stappen voltooid
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

function StepRow({ step, index }: { step: Step; index: number }) {
  return (
    <div
      className="step-row"
      style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '16px',
        borderRadius: '14px',
        backgroundColor: step.status === 'active'
          ? 'rgba(74,222,128,0.06)'
          : step.status === 'done'
          ? 'rgba(74,222,128,0.03)'
          : 'transparent',
        border: step.status === 'active'
          ? '1px solid rgba(74,222,128,0.15)'
          : '1px solid transparent',
        transition: 'all 0.3s ease',
        animationDelay: `${index * 0.08}s`,
        opacity: step.status === 'waiting' ? 0.35 : 1,
      }}>

      {/* Icon */}
      <div style={{ flexShrink: 0, width: '32px', height: '32px', position: 'relative' }}>
        {step.status === 'done' && (
          <div style={{
            width: '32px', height: '32px',
            backgroundColor: '#166534',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'done-scale 0.3s ease forwards',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2.5 7L5.5 10L11.5 4"
                stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="20"
                style={{ animation: 'check-draw 0.3s ease forwards' }}
              />
            </svg>
          </div>
        )}
        {step.status === 'active' && (
          <div style={{ position: 'relative', width: '32px', height: '32px' }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              backgroundColor: 'rgba(74,222,128,0.15)',
              animation: 'pulse-ring 1.5s ease infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '4px',
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: '#4ade80',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}
        {step.status === 'waiting' && (
          <div style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            border: '1px solid #1f2937',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '6px', height: '6px',
              borderRadius: '50%',
              backgroundColor: '#374151',
            }} />
          </div>
        )}
        {step.status === 'error' && (
          <div style={{
            width: '32px', height: '32px',
            backgroundColor: 'rgba(239,68,68,0.15)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#ef4444', fontSize: '14px' }}>✕</span>
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: '0 0 2px',
          fontSize: '14px',
          fontWeight: step.status === 'active' ? 500 : 400,
          color: step.status === 'active' ? '#f0fdf4'
            : step.status === 'done' ? '#86efac'
            : step.status === 'error' ? '#fca5a5'
            : '#4b5563',
          fontFamily: "'DM Sans', sans-serif",
          transition: 'color 0.3s ease',
        }}>
          {step.status === 'active' ? (
            <span className="shimmer-text">{step.label}</span>
          ) : step.label}
        </p>
        <p style={{
          margin: 0,
          fontSize: '12px',
          color: step.status === 'active' ? '#4ade80' : '#374151',
          fontFamily: "'DM Sans', sans-serif",
          transition: 'color 0.3s ease',
        }}>
          {step.sublabel}
        </p>
      </div>
    </div>
  )
}

export default function SyncPage() {
  return (
    <Suspense fallback={null}>
      <SyncContent />
    </Suspense>
  )
}