import { NextResponse } from 'next/server'

// Meest gebruikte NL/BE banken voor Fynn
export const NL_BE_BANKS = [
  { name: 'ABN AMRO', country: 'NL', logo: '🏦' },
  { name: 'ING', country: 'NL', logo: '🏦' },
  { name: 'Rabobank', country: 'NL', logo: '🏦' },
  { name: 'SNS Bank', country: 'NL', logo: '🏦' },
  { name: 'ASN Bank', country: 'NL', logo: '🏦' },
  { name: 'RegioBank', country: 'NL', logo: '🏦' },
  { name: 'Triodos Bank', country: 'NL', logo: '🏦' },
  { name: 'Knab', country: 'NL', logo: '🏦' },
  { name: 'Bunq', country: 'NL', logo: '🏦' },
  { name: 'KBC', country: 'BE', logo: '🏦' },
  { name: 'BNP Paribas Fortis', country: 'BE', logo: '🏦' },
  { name: 'ING', country: 'BE', logo: '🏦' },
  { name: 'Belfius', country: 'BE', logo: '🏦' },
]

export async function GET() {
  return NextResponse.json({ banks: NL_BE_BANKS })
}