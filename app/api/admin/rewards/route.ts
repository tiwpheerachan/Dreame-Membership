// ============================================================
// GET  /api/admin/rewards   — list rewards (with model joined)
// POST /api/admin/rewards   — create reward
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function authStaff() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff }
}

export async function GET() {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: rewards, error } = await auth.service
    .from('rewards')
    .select('*, reward_models(id, name, slug)')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate redemption counts — ใช้ SQL view (1 query) แทน fetch ทั้ง table
  const ids = (rewards || []).map(r => r.id as string)
  let counts: Record<string, { total: number; pending: number; delivered: number }> = {}
  if (ids.length > 0) {
    const { data: aggs, error: aggErr } = await auth.service
      .from('v_reward_redemption_counts')
      .select('reward_id, total, pending, delivered')
      .in('reward_id', ids)
    if (!aggErr) {
      for (const a of aggs || []) {
        counts[a.reward_id as string] = {
          total:     Number(a.total) || 0,
          pending:   Number(a.pending) || 0,
          delivered: Number(a.delivered) || 0,
        }
      }
    } else {
      // Fallback ถ้า view ยังไม่ apply (migration 0026 ยังไม่ run)
      const { data: reds } = await auth.service
        .from('redemptions').select('reward_id, status').in('reward_id', ids)
      for (const r of reds || []) {
        const rid = r.reward_id as string
        counts[rid] = counts[rid] || { total: 0, pending: 0, delivered: 0 }
        counts[rid].total++
        if (r.status === 'pending')   counts[rid].pending++
        if (r.status === 'delivered') counts[rid].delivered++
      }
    }
  }

  return NextResponse.json({ rewards: rewards || [], counts })
}

export async function POST(req: Request) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  if (!body.name)            return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!body.points_required) return NextResponse.json({ error: 'points_required required' }, { status: 400 })

  const insert = {
    model_id:                  body.model_id || null,
    name:                      String(body.name).trim(),
    short_description:         body.short_description || null,
    description:               body.description || null,
    image_url:                 body.image_url || null,
    images:                    Array.isArray(body.images) ? body.images : [],
    points_required:           Number(body.points_required),
    stock:                     body.stock ?? null,
    stock_remaining:           body.stock ?? null,
    allowed_tiers:             Array.isArray(body.allowed_tiers) && body.allowed_tiers.length > 0
                                 ? body.allowed_tiers
                                 : ['SILVER', 'GOLD', 'PLATINUM'],
    terms:                     body.terms || null,
    redemption_limit_per_user: body.redemption_limit_per_user || null,
    starts_at:                 body.starts_at || null,
    ends_at:                   body.ends_at || null,
    status:                    body.status || 'active',
    is_featured:               Boolean(body.is_featured),
    display_order:             body.display_order ?? 0,
    created_by:                auth.staff.id,
    // 3 redemption modes
    redeem_type:               body.redeem_type || 'PREMIUM',
    cash_top_up_thb:           body.cash_top_up_thb ?? null,
    original_price_thb:        body.original_price_thb ?? null,
    voucher_value_thb:         body.voucher_value_thb ?? null,
    voucher_min_purchase_thb:  body.voucher_min_purchase_thb ?? 0,
    shopify_product_url:       body.shopify_product_url || null,
    code_validity_days:        body.code_validity_days || 30,
  }

  const { data, error } = await auth.service.from('rewards').insert(insert).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    staffId: auth.staff.id,
    action: 'COUPON_SHOPIFY_BATCH_CREATED', // reuse
    targetType: 'reward',
    targetId: (data as { id: string }).id,
    detail: { staff_name: auth.staff.name, operation: 'reward_create', name: insert.name, points: insert.points_required },
  })
  revalidatePath('/admin/rewards')
  revalidatePath('/rewards')

  return NextResponse.json({ success: true, reward: data })
}
