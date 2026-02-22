'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateBriefingButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleGenerate() {
    setLoading(true)
    try {
      const response = await fetch('/api/ai/briefing', { method: 'POST' })
      const data = await response.json()
      if (data.success) router.refresh()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="text-xs font-medium px-3 py-2 rounded-lg text-white disabled:opacity-50 transition-opacity"
      style={{ backgroundColor: '#1A3A2A' }}
    >
      {loading ? 'Genereren...' : '✨ Genereer'}
    </button>
  )
}