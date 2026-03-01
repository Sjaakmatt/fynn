import { NextRequest, NextResponse } from 'next/server'
import { ebFetch } from '@/lib/enablebanking'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const country = searchParams.get('country') ?? 'NL'
  const data = await ebFetch(`/aspsps?country=${country}`)
  return NextResponse.json(data)
}