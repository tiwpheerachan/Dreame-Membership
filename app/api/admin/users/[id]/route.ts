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

  // ── Editable profile fields ──
  // Trim strings; empty → null (so admins can clear a field). email/phone also
  // sync to auth.users below (users.id IS the auth user id), because that's what
  // the customer's OTP / magic-link login actually uses.
  const norm = (v: unknown) => {
    const s = (v ?? '').toString().trim()
    return s === '' ? null : s
  }
  const PROFILE_FIELDS = ['full_name', 'email', 'phone', 'address', 'date_of_birth'] as const
  for (const f of PROFILE_FIELDS) {
    if (body[f] !== undefined) updates[f] = norm(body[f])
  }
  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email as string)) {
    return NextResponse.json({ error: 'อีเมลไม่ถูกต้อง' }, { status: 400 })
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 })
  }

  // Read current to compare (for audit + auth sync)
  const { data: before } = await service.from('users')
    .select('tier, full_name, email, phone, address, date_of_birth').eq('id', params.id).single()
  if (!before) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Sync EMAIL to auth.users (the email magic-link / email+password identity)
  // BEFORE the profile row — if it fails (e.g. email already used by another
  // auth user) we bail without a half-edit. email_confirm:true so the admin's
  // value is authoritative (no confirmation email round-trip).
  // PHONE is deliberately NOT synced to auth: this project's Supabase phone
  // provider rejects admin phone writes (E.164 → "unexpected_failure"), and the
  // phone-OTP flow sets auth.phone itself at login. Editing phone here updates
  // the CRM contact value only.
  if ('email' in updates && updates.email !== before.email && updates.email) {
    const { error: authErr } = await service.auth.admin.updateUserById(
      params.id, { email: updates.email as string, email_confirm: true },
    )
    if (authErr) {
      return NextResponse.json({ error: `เปลี่ยนอีเมล login ไม่สำเร็จ: ${authErr.message}` }, { status: 400 })
    }
  }

  const { error } = await service.from('users').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (updates.tier && updates.tier !== before.tier) {
    await logAdminAction({
      staffId: staff.id, action: 'TIER_OVERRIDDEN', targetType: 'user',
      targetId: params.id, userId: params.id,
      detail: { staff_name: staff.name, old_tier: before.tier, new_tier: updates.tier, reason },
    })
  }

  // Audit profile-field changes (record only the fields that actually changed)
  const changed: Record<string, { from: unknown; to: unknown }> = {}
  for (const f of PROFILE_FIELDS) {
    if (f in updates && updates[f] !== (before as Record<string, unknown>)[f]) {
      changed[f] = { from: (before as Record<string, unknown>)[f], to: updates[f] }
    }
  }
  if (Object.keys(changed).length > 0) {
    await logAdminAction({
      staffId: staff.id, action: 'MEMBER_EDITED', targetType: 'user',
      targetId: params.id, userId: params.id,
      detail: { staff_name: staff.name, changed },
    })
  }

  revalidatePath('/admin')
  revalidatePath('/admin/members')
  revalidatePath(`/admin/members/${params.id}`)

  return NextResponse.json({ success: true, staff_name: staff.name })
}
