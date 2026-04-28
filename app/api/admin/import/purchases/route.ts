import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logAdminAction } from '@/lib/audit'

interface Row {
  member_id?: string
  phone?: string
  email?: string
  order_sn: string
  invoice_no?: string
  channel?: string
  channel_type?: string
  model_name?: string
  sku?: string
  serial_number?: string
  purchase_date?: string
  total_amount?: number
  warranty_months?: number
}

interface RowResult {
  row: number
  ok: boolean
  message: string
  user_id?: string
  reg_id?: string
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let rows: Row[] = []
  try {
    const body = await req.json()
    rows = body.rows || []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!rows.length) return NextResponse.json({ error: 'No rows' }, { status: 400 })

  const results: RowResult[] = []
  let success = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineNo = i + 2 // +2 because of header row (1) and zero-index

    if (!row.order_sn) {
      results.push({ row: lineNo, ok: false, message: 'order_sn ว่าง' })
      continue
    }

    // Find user by member_id, phone, or email
    let userId: string | null = null
    if (row.member_id) {
      const { data } = await service.from('users').select('id').eq('member_id', row.member_id).maybeSingle()
      userId = data?.id ?? null
    }
    if (!userId && row.phone) {
      const { data } = await service.from('users').select('id').eq('phone', row.phone).maybeSingle()
      userId = data?.id ?? null
    }
    if (!userId && row.email) {
      const { data } = await service.from('users').select('id').eq('email', row.email).maybeSingle()
      userId = data?.id ?? null
    }
    if (!userId) {
      results.push({ row: lineNo, ok: false, message: 'ไม่พบ user (กรอก member_id/phone/email)' })
      continue
    }

    // Check duplicate
    const { data: existing } = await service
      .from('purchase_registrations')
      .select('id')
      .eq('order_sn', row.order_sn)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) {
      results.push({ row: lineNo, ok: false, message: 'order_sn ซ้ำ', user_id: userId })
      continue
    }

    // Compute warranty
    const purchaseDate = row.purchase_date ? new Date(row.purchase_date) : new Date()
    const warrantyMonths = Number(row.warranty_months) || 12
    const warrantyEnd = new Date(purchaseDate)
    warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths)

    const { data: reg, error } = await service.from('purchase_registrations').insert({
      user_id: userId,
      order_sn: row.order_sn,
      invoice_no: row.invoice_no || null,
      channel: row.channel || 'OTHER',
      channel_type: row.channel_type || 'ONSITE',
      model_name: row.model_name || null,
      sku: row.sku || null,
      serial_number: row.serial_number || null,
      purchase_date: purchaseDate.toISOString().split('T')[0],
      total_amount: Number(row.total_amount) || 0,
      warranty_months: warrantyMonths,
      warranty_start: purchaseDate.toISOString().split('T')[0],
      warranty_end: warrantyEnd.toISOString().split('T')[0],
      bq_verified: false,
      status: 'ADMIN_APPROVED',
      approved_by: staff.id,
      approved_at: new Date().toISOString(),
    }).select().single()

    if (error) {
      results.push({ row: lineNo, ok: false, message: error.message, user_id: userId })
      continue
    }

    // Award points
    await service.rpc('award_points_for_purchase', { p_purchase_reg_id: reg.id })
    results.push({ row: lineNo, ok: true, message: 'success', user_id: userId, reg_id: reg.id })
    success++
  }

  await logAdminAction({
    staffId: staff.id,
    action: 'PURCHASE_ADDED',
    targetType: 'purchase',
    targetId: '00000000-0000-0000-0000-000000000000',
    detail: { staff_name: staff.name, source: 'csv_import', total: rows.length, success, failed: rows.length - success },
  })

  return NextResponse.json({
    total: rows.length,
    success,
    failed: rows.length - success,
    results,
  })
}
