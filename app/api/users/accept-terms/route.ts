import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS blocks UPDATE on public.users — go through service role
  const service = createServiceClient()

  // Make sure profile exists (idempotent — auto-create if first interaction)
  await service.from('users').upsert(
    { id: user.id, email: user.email ?? null },
    { onConflict: 'id', ignoreDuplicates: false }
  )

  const { error } = await service
    .from('users')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
