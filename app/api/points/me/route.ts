import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: profile }, { data: logs }] = await Promise.all([
    supabase.from('users').select('total_points, lifetime_points, tier').eq('id', authUser.id).single(),
    supabase.from('points_log').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(50),
  ])
  return NextResponse.json({ ...profile, logs })
}