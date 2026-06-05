import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const [{ data: member }, { data: purchases }, { data: points }, { data: coupons }] = await Promise.all([
    serviceSupabase.from('users').select('*').eq('id', params.id).single(),
    serviceSupabase.from('purchase_registrations').select('*').eq('user_id', params.id).order('created_at', { ascending: false }),
    serviceSupabase.from('points_log').select('*').eq('user_id', params.id).order('created_at', { ascending: false }).limit(30),
    serviceSupabase.from('coupons').select('*').eq('user_id', params.id),
  ])

  if (!member) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ user: member, purchases, points, coupons })
}

// PATCH — admin override (currently only `tier`). Logs audit entry.
const VALID_TIERS = ['SILVER', 'GOLD', 'PLATINUM'] as const
type Tier = typeof VALID_TIERS[number]

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', authUser.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  let reason: string | null = null

  if (body.tier !== undefined) {
    if (!VALID_TIERS.includes(body.tier as Tier)) {
      return NextResponse.json({ error: 'invalid tier — must be SILVER/GOLD/PLATINUM' }, { status: 400 })
    }
    updates.tier = body.tier
    reason = (body.reason || '').toString().trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 })
  }

  // Read current to compare
  const { data: before } = await service.from('users').select('tier').eq('id', params.id).single()
  if (!before) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { error } = await service.from('users').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (updates.tier && updates.tier !== before.tier) {
    await logAdminAction({
      staffId: staff.id,
      action: 'TIER_OVERRIDDEN',
      targetType: 'user',
      targetId: params.id,
      userId: params.id,
      detail: {
        staff_name: staff.name,
        old_tier: before.tier,
        new_tier: updates.tier,
        reason,
      },
    })
  }

  revalidatePath('/admin')
  revalidatePath('/admin/members')
  revalidatePath(`/admin/members/${params.id}`)

  return NextResponse.json({ success: true, staff_name: staff.name })
}
