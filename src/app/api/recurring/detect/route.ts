import { NextRequest } from 'next/server'
import { POST as recurringPost } from '@/app/api/sync/recurring/route'

export async function POST(request: NextRequest) {
  return recurringPost(request)
}