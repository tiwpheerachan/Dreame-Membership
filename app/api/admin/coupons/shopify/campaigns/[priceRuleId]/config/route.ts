// ============================================================
// GET / PUT /api/admin/coupons/shopify/campaigns/[priceRuleId]/config
//
// CRUD สำหรับ shopify_campaign_config — ตั้งกฎอัตโนมัติของแคมเปญ:
//   • low_pool_threshold + topup_batch_size — auto top-up
//   • auto_assign_tier + on_signup/on_upgrade — auto-assign คน
//
// PUT body (ทุก field optional):
//   {
//     title?:                 string
//     low_pool_threshold?:    number | null   // null = ปิด
//     topup_batch_size?:      number
//     topup_paused?:          boolean
//     auto_assign_tier?:      'SILVER'|'GOLD'|'PLATINUM' | null
//     auto_assign_on_signup?: boolean
//     auto_assign_on_upgrade?:boolean
//     default_value_type?:    'percentage'|'fixed_amount'
//     default_value?:         number
//     default_min_purchase?:  number
//     default_code_prefix?:   string
//     default_ends_at?:       string  ISO
//   }
//
// Auto-detect default_value_type/value จาก Shopify ถ้ายังไม่มี config row.
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'
import {
  getPerformance, isConfigured, DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'

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

export async function GET(
  req: Request,
  { params }: { params: { priceRuleId: string } },
) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const priceRuleId = Number(params.priceRuleId)
  if (!priceRuleId) return NextResponse.json({ error: 'invalid priceRuleId' }, { status: 400 })
  const shopId = new URL(req.url).searchParams.get('shop_id') || DEFAULT_SHOP_ID

  // ดึง config (ถ้ามี)
  const { data: cfg } = await auth.service
    .from('shopify_campaign_config')
    .select('*')
    .eq('shop_id', shopId)
    .eq('price_rule_id', priceRuleId)
    .maybeSingle()

  // ดึง pool snapshot จาก view
  const { data: pool } = await auth.service
    .from('v_shopify_campaign_pool')
    .select('pool_free, pool_assigned, pool_used, pool_total')
    .eq('shop_id', shopId)
    .eq('price_rule_id', priceRuleId)
    .maybeSingle()

  return NextResponse.json({
    config: cfg,
    pool: pool || { pool_free: 0, pool_assigned: 0, pool_used: 0, pool_total: 0 },
  })
}

export async function PUT(
  req: Request,
  { params }: { params: { priceRuleId: string } },
) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const priceRuleId = Number(params.priceRuleId)
  if (!priceRuleId) return NextResponse.json({ error: 'invalid priceRuleId' }, { status: 400 })
  const shopId = new URL(req.url).searchParams.get('shop_id') || DEFAULT_SHOP_ID

  const body = await req.json().catch(() => ({}))

  // ── ถ้ายังไม่มี row → auto-detect default จาก Shopify ──
  const { data: existing } = await auth.service
    .from('shopify_campaign_config')
    .select('id, default_value_type, default_value, default_code_prefix, default_ends_at, title')
    .eq('shop_id', shopId)
    .eq('price_rule_id', priceRuleId)
    .maybeSingle()

  let autoDefaults: {
    title?: string
    default_value_type?: 'percentage' | 'fixed_amount'
    default_value?: number
    default_ends_at?: string | null
    default_code_prefix?: string
  } = {}

  if (!existing && isConfigured()) {
    try {
      const perf = await getPerformance(shopId, priceRuleId)
      autoDefaults = {
        title:              perf.price_rule_title,
        default_value_type: perf.value_type as 'percentage' | 'fixed_amount',
        default_value:      Math.abs(parseFloat(String(perf.value)) || 0),
        default_ends_at:    perf.ends_at,
        default_code_prefix: perf.codes[0]?.code?.split('-')[0] || 'DREAME',
      }
    } catch (e) {
      // ไม่ critical — แค่ใช้ค่าจาก body
      const err = e as ShopifyDiscountError
      console.warn(`[config PUT] auto-detect failed: ${err.detail || err.message}`)
    }
  }

  // ── Validate & whitelist fields ──
  const allowed: Record<string, unknown> = {}
  const fields = [
    'title',
    'low_pool_threshold', 'topup_batch_size', 'topup_paused',
    'auto_assign_tier', 'auto_assign_on_signup', 'auto_assign_on_upgrade',
    'default_value_type', 'default_value', 'default_min_purchase',
    'default_code_prefix', 'default_ends_at',
  ]
  for (const f of fields) {
    if (f in body) allowed[f] = body[f]
  }

  // เซ็ต auto_issue_key อัตโนมัติเมื่อสร้างใหม่ (กันออกซ้ำให้ user คนเดียว)
  const isInsert = !existing
  if (isInsert) {
    allowed.shop_id        = shopId
    allowed.price_rule_id  = priceRuleId
    allowed.auto_issue_key = `SHOPIFY_CAMP_${priceRuleId}`
    allowed.created_by     = auth.staff.id
    // เติม defaults จาก Shopify ถ้า body ไม่ระบุ
    for (const [k, v] of Object.entries(autoDefaults)) {
      if (!(k in allowed)) allowed[k] = v
    }
  }

  // เคลียร์ค่า threshold เป็น NULL (ปิดฟีเจอร์) แทน 0
  if (allowed.low_pool_threshold === 0) allowed.low_pool_threshold = null

  let savedId: string
  if (isInsert) {
    const { data, error } = await auth.service
      .from('shopify_campaign_config')
      .insert(allowed as never)
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    savedId = (data as { id: string }).id
  } else {
    const { error } = await auth.service
      .from('shopify_campaign_config')
      .update(allowed as never)
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    savedId = existing.id as string
  }

  await logAdminAction({
    staffId:    auth.staff.id,
    action:     'COUPON_SHOPIFY_BATCH_CREATED', // reuse — แยก type ภายหลังได้
    targetType: 'coupon',
    detail: {
      staff_name:    auth.staff.name,
      operation:     isInsert ? 'config_create' : 'config_update',
      shop_id:       shopId,
      price_rule_id: priceRuleId,
      changes:       allowed,
    },
  })

  revalidatePath('/admin/coupons/shopify')
  revalidatePath(`/admin/coupons/campaign/${priceRuleId}`)

  return NextResponse.json({ success: true, id: savedId })
}
