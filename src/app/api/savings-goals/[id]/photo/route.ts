import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verifieer dat het goal van deze user is
    const { data: goal } = await supabase
      .from('savings_goals')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!goal) return NextResponse.json({ error: 'Doel niet gevonden' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Alleen afbeeldingen toegestaan' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Bestand te groot (max 5MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${id}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('goal-photos')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('[photo upload]', uploadError)
      // Geef bruikbare foutmelding terug aan de client
      if (uploadError.message?.includes('Bucket not found') || (uploadError as { statusCode?: string }).statusCode === '404') {
        return NextResponse.json({
          error: 'Storage bucket niet gevonden. Maak een bucket "goal-photos" aan in het Supabase dashboard onder Storage.'
        }, { status: 500 })
      }
      return NextResponse.json({ error: 'Upload mislukt: ' + uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('goal-photos')
      .getPublicUrl(path)

    // Voeg timestamp toe aan URL zodat elke upload als nieuw bestand herkend wordt door de browser
    const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`

    await supabase
      .from('savings_goals')
      .update({ photo_url: photoUrl })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ photo_url: photoUrl })
  } catch (error) {
    console.error('[savings-goals photo] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}