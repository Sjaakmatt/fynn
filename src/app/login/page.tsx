'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mailadres of wachtwoord klopt niet.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F7F5F2' }}>
      {/* Links — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 p-10 text-white"
        style={{ backgroundColor: '#1A3A2A' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <span className="font-semibold">Fynn</span>
        </div>
        <div>
          <p className="text-2xl font-semibold leading-snug mb-4">
            "Ik wist niet waar mijn geld naartoe ging. Nu wel."
          </p>
          <p className="text-sm opacity-60">— Gebruiker uit Amsterdam</p>
        </div>
        <div className="space-y-3">
          {['Bankrekening koppelen in 3 minuten', 'AI analyseert al je uitgaven', 'Elke week een persoonlijk advies'].map(item => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(74,222,128,0.2)' }}>
                <span style={{ color: '#4ADE80', fontSize: 9 }}>✓</span>
              </div>
              <p className="text-sm opacity-80">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rechts — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#1A3A2A' }}>
              <span className="text-white text-xs font-bold">F</span>
            </div>
            <span className="font-semibold">Fynn</span>
          </div>

          <h1 className="text-2xl font-semibold mb-1" style={{ color: '#111827' }}>
            Welkom terug
          </h1>
          <p className="text-sm mb-8" style={{ color: '#9CA3AF' }}>
            Log in om je financieel overzicht te bekijken.
          </p>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                color: '#111827',
              }}
              required
            />
            <input
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                color: '#111827',
              }}
              required
            />

            {error && (
              <p className="text-sm px-1" style={{ color: '#EF4444' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-50 transition-opacity mt-1"
              style={{ backgroundColor: '#1A3A2A' }}
            >
              {loading ? 'Inloggen...' : 'Inloggen'}
            </button>
          </form>

          <p className="text-sm text-center mt-6" style={{ color: '#9CA3AF' }}>
            Nog geen account?{' '}
            <a href="/signup" className="font-medium" style={{ color: '#1A3A2A' }}>
              Gratis aanmelden
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}