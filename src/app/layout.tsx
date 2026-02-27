import type { Metadata } from 'next'
import { Sora } from 'next/font/google'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"

const sora = Sora({ 
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['300', '400', '500', '600', '700']
})

export const metadata: Metadata = {
  title: 'Fynn — Jouw financieel kompas',
  description: 'AI-powered persoonlijke financiële coach',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" className={sora.variable}>
      <Analytics/>
      <body className="font-sora antialiased">
        {children}
      </body>
    </html>
  )
}