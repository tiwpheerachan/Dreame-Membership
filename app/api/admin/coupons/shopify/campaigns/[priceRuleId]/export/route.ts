// ============================================================
// GET /api/admin/coupons/shopify/campaigns/[priceRuleId]/export
//
// Export ทุก code ใน campaign เป็น CSV
// Columns: code, status, used_at, user_id, member_id, full_name, tier,
//          shipping_phone, apply_url, created_at
//
// Query params:
//   shop_id   default DEFAULT_SHOP_ID
//   status    filter เฉพาะ status ('active' | 'paused' | ...)
//   used      'true' | 'false' (filter used vs unused)
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { DEFAULT_SHOP_ID } from '@/lib/shopify-discounts'

export const dynamic = 'force-dynamic'

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(
  req: Request,
  { params }: { params: { priceRuleId: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const priceRuleId = Number(params.priceRuleId)
  if (!priceRuleId) return NextResponse.json({ error: 'invalid priceRuleId' }, { status: 400 })
  const url = new URL(req.url)
  const shopId = url.searchParams.get('shop_id') || DEFAULT_SHOP_ID
  const statusFilter = url.searchParams.get('status')
  const usedFilter   = url.searchParams.get('used')

  let q = service.from('coupons')
    .select('code, status, used_at, used_count, user_id, apply_url, created_at, users(full_name, member_id, tier, phone)')
    .eq('shopify_shop_id', shopId)
    .eq('shopify_price_rule_id', priceRuleId)
    .order('created_at', { ascending: true })

  if (statusFilter) q = q.eq('status', statusFilter)
  if (usedFilter === 'true')  q = q.not('used_at', 'is', null)
  if (usedFilter === 'false') q = q.is('used_at', null)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type UserJoin = { full_name: string | null; member_id: string | null; tier: string | null; phone: string | null }
  type Row = {
    code: string; status: string | null; used_at: string | null
    used_count: number; user_id: string | null; apply_url: string | null
    created_at: string
    users: UserJoin | UserJoin[] | null
  }
  const rows = (data || []) as unknown as Row[]

  const headers = [
    'code', 'status', 'used_at', 'used_count',
    'member_id', 'full_name', 'tier', 'phone',
    'apply_url', 'created_at',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    lines.push([
      r.code, r.status || 'active', r.used_at || '',
      r.used_count || 0,
      u?.member_id || '', u?.full_name || '', u?.tier || '', u?.phone || '',
      r.apply_url || '',
      r.created_at,
    ].map(csvEscape).join(','))
  }

  const csv = '﻿' + lines.join('\n')  // BOM ช่วย Excel TH render UTF-8 ถูก
  const filename = `campaign-${priceRuleId}-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}
