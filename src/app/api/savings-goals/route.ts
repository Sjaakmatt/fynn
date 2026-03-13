import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/savings-goals ───────────────────────────────────────────────────
// Haalt alle doelen op voor de ingelogde user, verrijkt met:
//   - linked accounts (gefilterd uit bank_accounts op account_ids[])
//   - berekende velden: current_amount, monthly_needed, months_left, progress_pct, on_track
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: goals, error } = await supabase
      .from('savings_goals')
      .select('id, name, target_amount, deadline, account_ids, photo_url, notes, ai_tip, ai_tip_generated_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[savings-goals GET]', error)
      return NextResponse.json({ error: 'Database fout' }, { status: 500 })
    }

    // Verzamel alle unieke account_ids over alle goals
    const allAccountIds = [...new Set(goals.flatMap(g => g.account_ids ?? []))]

    // Haal die accounts op in één query
    let accountMap: Record<string, { id: string; account_name: string; iban: string; balance: number; account_type: string }> = {}
    if (allAccountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('id, account_name, iban, balance, account_type')
        .eq('user_id', user.id)
        .in('id', allAccountIds)

      accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a]))
    }

    const today = new Date()

    const enriched = goals.map(goal => {
      const linkedAccounts = (goal.account_ids ?? [])
        .map((id: string) => accountMap[id])
        .filter(Boolean)

      const currentAmount = linkedAccounts.reduce(
        (sum: number, acc: { balance: number }) => sum + (Number(acc.balance) || 0),
        0
      )

      const deadline = new Date(goal.deadline)
      const monthsLeft = Math.max(
        0,
        (deadline.getFullYear() - today.getFullYear()) * 12 +
          (deadline.getMonth() - today.getMonth())
      )

      const remaining = Math.max(0, goal.target_amount - currentAmount)
      const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining
      const progressPct = Math.min(100, (currentAmount / goal.target_amount) * 100)

      // Op koers: verwacht lineaire voortgang vs. werkelijk
      const createdAt = new Date(goal.created_at)
      const monthsSinceCreated = Math.max(
        1,
        (today.getFullYear() - createdAt.getFullYear()) * 12 +
          (today.getMonth() - createdAt.getMonth())
      )
      const totalMonths = monthsSinceCreated + monthsLeft
      const expectedPct = totalMonths > 0 ? (monthsSinceCreated / totalMonths) * 100 : 0
      const onTrack = progressPct >= expectedPct * 0.9 // 10% marge

      return {
        id: goal.id,
        name: goal.name,
        target_amount: goal.target_amount,
        deadline: goal.deadline,
        account_ids: goal.account_ids ?? [],
        photo_url: goal.photo_url ?? null,
        notes: goal.notes ?? null,
        ai_tip: goal.ai_tip,
        ai_tip_generated_at: goal.ai_tip_generated_at,
        created_at: goal.created_at,
        linked_accounts: linkedAccounts,
        current_amount: Math.round(currentAmount * 100) / 100,
        monthly_needed: Math.round(monthlyNeeded * 100) / 100,
        months_left: monthsLeft,
        progress_pct: Math.round(progressPct * 10) / 10,
        on_track: onTrack,
      }
    })

    return NextResponse.json({ goals: enriched })
  } catch (error) {
    console.error('[savings-goals GET] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/savings-goals ──────────────────────────────────────────────────
// Body: { name: string, target_amount: number, deadline: string, account_ids?: string[] }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, target_amount, deadline, account_ids = [], notes = null } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }
    const amt = Number(target_amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Doelbedrag moet groter dan 0 zijn' }, { status: 400 })
    }
    if (!deadline || isNaN(Date.parse(deadline))) {
      return NextResponse.json({ error: 'Deadline is ongeldig' }, { status: 400 })
    }
    if (new Date(deadline) <= new Date()) {
      return NextResponse.json({ error: 'Deadline moet in de toekomst liggen' }, { status: 400 })
    }

    // Verifieer dat de opgegeven account_ids van deze user zijn
    let safeAccountIds: string[] = []
    if (account_ids.length > 0) {
      const { data: validAccounts } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .in('id', account_ids)
      safeAccountIds = (validAccounts ?? []).map((a: { id: string }) => a.id)
    }

    const { data: goal, error } = await supabase
      .from('savings_goals')
      .insert({
        user_id: user.id,
        name: name.trim(),
        target_amount: amt,
        deadline,
        account_ids: safeAccountIds,
        notes: notes ?? null,
      })
      .select()
      .single()

    if (error || !goal) {
      console.error('[savings-goals POST]', error)
      return NextResponse.json({ error: 'Kon doel niet aanmaken' }, { status: 500 })
    }

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error) {
    console.error('[savings-goals POST] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}