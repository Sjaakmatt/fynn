import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const params = new URLSearchParams({
      client_id: process.env.TINK_CLIENT_ID!,
      redirect_uri: process.env.TINK_REDIRECT_URI!,
      market: 'NL',
      locale: 'nl_NL',
      test: 'true',
    })

    const url = `https://link.tink.com/1.0/transactions/connect-accounts?${params}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Tink link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}