import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const [{ data: user }, { data: purchases }, { data: points }, { data: coupons }] = await Promise.all([
    serviceSupabase.from('users').select('*').eq('id', params.id).single(),
    serviceSupabase.from('purchase_registrations').select('*').eq('user_id', params.id).order('created_at', { ascending: false }),
    serviceSupabase.from('points_log').select('*').eq('user_id', params.id).order('created_at', { ascending: false }).limit(30),
    serviceSupabase.from('coupons').select('*').eq('user_id', params.id),
  ])

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ user, purchases, points, coupons })
}
