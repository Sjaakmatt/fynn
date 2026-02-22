'use client'

import { useState } from 'react'

interface ConnectBankProps {
  userId: string
  label?: string
  compact?: boolean
}

export default function ConnectBank({ userId, label = 'Bankrekening koppelen', compact = false }: ConnectBankProps) {
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    setLoading(true)
    try {
      const response = await fetch('/api/tink/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await response.json()
      if (data.url) window.location.href = data.url
    } catch (error) {
      console.error(error)
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleConnect}
        disabled={loading}
        className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors disabled:opacity-50"
      >
        {loading ? '...' : label}
      </button>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="px-6 py-3 rounded-xl font-medium text-sm text-white disabled:opacity-50 transition-opacity"
      style={{ backgroundColor: '#1A3A2A' }}
    >
      {loading ? 'Laden...' : label}
    </button>
  )
}