import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: coupons } = await supabase.from('coupons').select('*')
    .eq('user_id', user!.id).order('valid_until', { ascending: true })
  return NextResponse.json({ coupons })
}
