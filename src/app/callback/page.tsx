'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function CallbackHandler() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      return
    }

    if (!code) {
      setStatus('error')
      return
    }

    async function handleCallback() {
      try {
        const response = await fetch('/api/tink/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })

        if (response.ok) {
          setStatus('success')
          setTimeout(() => router.push('/dashboard'), 2000)
        } else {
          setStatus('error')
        }
      } catch {
        setStatus('error')
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
            <p className="text-gray-600">Bankrekening koppelen...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <p className="font-medium">Bankrekening gekoppeld!</p>
            <p className="text-gray-500 text-sm mt-1">Je wordt doorgestuurd naar je dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <p className="font-medium">Er ging iets mis</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 text-sm underline text-gray-500"
            >
              Terug naar dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  )
}