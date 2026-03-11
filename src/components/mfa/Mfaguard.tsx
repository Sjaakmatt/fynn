// src/components/mfa/MFAGuard.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MFAChallenge from './Mfachallenge'

interface MFAGuardProps {
  children: React.ReactNode
}

/**
 * Wrap je authenticated pages/layouts met MFAGuard.
 *
 * Checkt na login of de user een verified TOTP factor heeft
 * maar nog op AAL1 zit (= MFA challenge nodig).
 *
 * Als geen MFA enrolled is, wordt de content gewoon getoond.
 */
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
      // Geen sessie of error — doorsturen naar login
      router.push('/login')
      return
    }

    if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
      // User heeft MFA enrolled maar zit nog op level 1 — challenge nodig
      setStatus('mfa_required')
    } else {
      // Geen MFA enrolled (nextLevel = aal1) óf al op aal2
      setStatus('ready')
    }
  }

  async function handleMFASuccess() {
    // Na succesvolle MFA, hercheck AAL (sessie is nu geüpdatet)
    setStatus('ready')
  }

  async function handleCancel() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F7F5F2' }}>
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#1A3A2A] rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'mfa_required') {
    return <MFAChallenge onSuccess={handleMFASuccess} onCancel={handleCancel} />
  }

  return <>{children}</>
}