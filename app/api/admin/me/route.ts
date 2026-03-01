import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase
    .from('admin_staff')
    .select('id, name, email, role, channel_access')
    .eq('auth_user_id', session.user.id)
    .eq('is_active', true)
    .single()

  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(staff)
}