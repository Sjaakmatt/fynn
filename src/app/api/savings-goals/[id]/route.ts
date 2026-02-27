import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── DELETE /api/savings-goals/[id] ──────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[savings-goals DELETE]', error)
      return NextResponse.json({ error: 'Kon doel niet verwijderen' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[savings-goals DELETE] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH /api/savings-goals/[id] ───────────────────────────────────────────
// Body: { notes?: string, photo_url?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const allowed = ['notes', 'photo_url']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Geen geldige velden' }, { status: 400 })
    }

    const { data: goal, error } = await supabase
      .from('savings_goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !goal) {
      console.error('[savings-goals PATCH]', error)
      return NextResponse.json({ error: 'Update mislukt' }, { status: 500 })
    }

    return NextResponse.json({ goal })
  } catch (error) {
    console.error('[savings-goals PATCH] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}