import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: transactions } = await supabase
      .from('transactions')
      .select('description, amount, transaction_date, category')
      .eq('user_id', user.id)
      .in('category', ['abonnementen', 'wonen', 'gezondheid', 'transport'])
      .lt('amount', 0)
      .order('transaction_date', { ascending: false })

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ items: [], totalBalance: 0, upcomingTotal: 0, balanceWarning: false })
    }

    // Groepeer per beschrijving
    const grouped: Record<string, { description: string; amount: number; dates: string[] }> = {}
    transactions.forEach(tx => {
      const key = tx.description.toLowerCase().trim()
      if (!grouped[key]) grouped[key] = {
        description: tx.description,
        amount: Math.abs(parseFloat(tx.amount)),
        dates: []
      }
      grouped[key].dates.push(tx.transaction_date)
    })

    // Haal huidige datum op in Nederlandse tijdzone
    const nlDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date())
    const [todayYear, todayMonth0, todayDate] = nlDate.split('-').map(Number)
    const todayMonth = todayMonth0 - 1 // 0-indexed

    const todayMidnight = new Date(Date.UTC(todayYear, todayMonth, todayDate))

    const items = []

    for (const [, data] of Object.entries(grouped)) {
      if (data.dates.length < 1) continue

      const sortedDates = data.dates.sort()
      const lastDate = new Date(sortedDates[sortedDates.length - 1])
      const dayOfMonth = lastDate.getDate()

      const thisMonth = new Date(Date.UTC(todayYear, todayMonth, dayOfMonth))
      const nextMonth = new Date(Date.UTC(todayYear, todayMonth + 1, dayOfMonth))

      const daysUntil = Math.round((thisMonth.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))
      const isPast = daysUntil < 0
      const warning = daysUntil >= 0 && daysUntil <= 3

      items.push({
        name: data.description,
        amount: data.amount,
        nextDate: nextMonth.toISOString().split('T')[0],
        thisMonthDate: thisMonth.toISOString().split('T')[0],
        dayOfMonth,
        daysUntil,
        isPast,
        warning,
      })
    }

    // Sorteer op dag van de maand
    items.sort((a, b) => a.dayOfMonth - b.dayOfMonth)

    const { data: accounts } = await supabase
      .from('bank_accounts')
      .select('balance, account_type')
      .eq('user_id', user.id)

    const totalBalance = accounts
      ?.filter(a => a.account_type === 'CHECKING' || a.account_type == null)
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0) ?? 0


    // Som van betalingen binnen 3 dagen
    const upcomingTotal = items
      .filter(i => !i.isPast && i.daysUntil <= 3)
      .reduce((sum, i) => sum + i.amount, 0)

    const balanceWarning = upcomingTotal > totalBalance

    return NextResponse.json({ items, totalBalance, upcomingTotal, balanceWarning })

  } catch (error) {
    console.error('Calendar error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}