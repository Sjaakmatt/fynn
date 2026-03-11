// src/app/dashboard/layout.tsx
import MFAGuard from '@/components/mfa/Mfaguard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MFAGuard>{children}</MFAGuard>
}