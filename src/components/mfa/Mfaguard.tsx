// src/components/mfa/MFAGuard.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MFAChallenge from './Mfachallenge'

interface MFAGuardProps {
  children: React.ReactNode
}

export default function MFAGuard({ children }: MFAGuardProps) {
  const [status, setStatus] = useState<'loading' | 'mfa_required' | 'ready'>('loading')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAAL()
  }, [])

  async function checkAAL() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (error) {
      router.push('/login')
      return
    }

    if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
      setStatus('mfa_required')
    } else {
      setStatus('ready')
    }
  }

  async function handleMFASuccess() {
    setStatus('ready')
  }

  async function handleCancel() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (status === 'mfa_required') {
    return <MFAChallenge onSuccess={handleMFASuccess} onCancel={handleCancel} />
  }

  return <>{children}</>
}