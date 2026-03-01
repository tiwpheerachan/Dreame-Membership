import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('purchase_registrations').select('*')
    .eq('user_id', session.user.id).order('created_at', { ascending: false })
  return NextResponse.json({ purchases: data })
}
