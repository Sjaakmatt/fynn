import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const category = request.nextUrl.searchParams.get('category')

  let query = supabase
    .from('transactions')
    .select('id, description, amount, transaction_date, category')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })

  if (category) query = query.eq('category', category)

  const { data } = await query
  return NextResponse.json({ transactions: data ?? [] })
}