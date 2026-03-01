import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: user }, { data: logs }] = await Promise.all([
    supabase.from('users').select('total_points, lifetime_points, tier').eq('id', session.user.id).single(),
    supabase.from('points_log').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50),
  ])
  return NextResponse.json({ ...user, logs })
}
