// /api/admin/privileges — จัดการสิทธิรับน้ำยาฟรี (staff เท่านั้น)
//   GET   ?q=<คำค้น> [&deleted=1]  รายการสิทธิ (ใช้งาน / ถังขยะ)
//   POST  เพิ่มสิทธิเอง (source=ADMIN) → trigger สร้าง 4 รอบให้อัตโนมัติ
//   PATCH { id, action: 'delete' | 'restore' }  ลบ (soft) / กู้คืน
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

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

// เบอร์ในตารางเก็บ national 9 หลัก (ตัด 0 หน้า)
function last9(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : null
}

export async function GET(req: Request) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()
  const deleted = url.searchParams.get('deleted') === '1'

  let query = auth.service
    .from('refill_privileges')
    .select('*')
    .order('purchased_at', { ascending: false })
    .limit(500)

  // แยกมุมมอง: ใช้งาน (deleted_at NULL) หรือ ถังขยะ (deleted_at NOT NULL)
  query = deleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)

  if (q) {
    const digits = q.replace(/\D/g, '')
    const ors = [
      `customer_name.ilike.*${q}*`,
      `transaction_id.ilike.*${q}*`,
      `model.ilike.*${q}*`,
    ]
    if (digits.length >= 4) ors.push(`phone.ilike.*${digits.slice(-9)}*`)
    query = query.or(ors.join(','))
  }

  const { data: privs, error } = await query
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ privileges: [], not_migrated: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = privs || []
  if (list.length === 0) return NextResponse.json({ privileges: [] })

  const ids = list.map(p => p.id as string)
  const { data: rounds } = await auth.service
    .from('refill_rounds').select('*')
    .in('privilege_id', ids)
    .order('round_no', { ascending: true })

  const byPriv: Record<string, unknown[]> = {}
  for (const r of rounds || []) (byPriv[r.privilege_id as string] ||= []).push(r)

  const result = list.map(p => ({ ...p, rounds: byPriv[p.id as string] || [] }))
  return NextResponse.json({ privileges: result })
}

// เพิ่มสิทธิเอง — 1 ออเดอร์/ลูกค้า = 1 สิทธิ (trigger gen_refill_rounds สร้าง 4 รอบให้)
export async function POST(req: Request) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({})) as Record<string, string>
  const phone = last9(b.phone)
  if (!phone) return NextResponse.json({ error: 'กรุณากรอกเบอร์โทรให้ถูกต้อง (อย่างน้อย 9 หลัก)' }, { status: 400 })
  const purchased_at = (b.purchased_at || '').trim()
  if (!purchased_at) return NextResponse.json({ error: 'กรุณาระบุวันที่ซื้อ' }, { status: 400 })

  const amount = b.order_amount != null && String(b.order_amount).trim() !== ''
    ? Number(String(b.order_amount).replace(/[^\d.]/g, '')) : null

  const { data: created, error } = await auth.service
    .from('refill_privileges')
    .insert({
      phone,
      customer_name: b.customer_name?.trim() || null,
      transaction_id: b.transaction_id?.trim() || null,
      model:          b.model?.trim() || null,
      branch:         b.branch?.trim() || null,
      member_type:    b.member_type?.trim() || null,
      order_amount:   Number.isFinite(amount as number) ? amount : null,
      purchased_at,
      source: 'ADMIN',
      note:   b.note?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    if (/uniq_refill_priv_txn/.test(error.message)) {
      return NextResponse.json({ error: 'Transaction ID นี้มีสิทธิอยู่แล้ว' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction({
    staffId: auth.staff.id,
    action: 'REFILL_PRIVILEGE_ADDED',
    targetType: 'refill_privilege',
    targetId: created.id,
    detail: { staff_name: auth.staff.name, phone, model: b.model, amount },
  })

  revalidatePath('/admin/privileges')
  revalidatePath('/privileges')
  return NextResponse.json({ success: true, id: created.id })
}

// ลบ (soft) / กู้คืน
export async function PATCH(req: Request) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({})) as { id?: string; action?: 'delete' | 'restore' }
  if (!b.id || (b.action !== 'delete' && b.action !== 'restore')) {
    return NextResponse.json({ error: 'id และ action (delete | restore) จำเป็น' }, { status: 400 })
  }

  const patch = b.action === 'delete'
    ? { deleted_at: new Date().toISOString(), deleted_by: auth.staff.id }
    : { deleted_at: null, deleted_by: null }

  const { error } = await auth.service.from('refill_privileges').update(patch).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    staffId: auth.staff.id,
    action: b.action === 'delete' ? 'REFILL_PRIVILEGE_DELETED' : 'REFILL_PRIVILEGE_RESTORED',
    targetType: 'refill_privilege',
    targetId: b.id,
    detail: { staff_name: auth.staff.name },
  })

  revalidatePath('/admin/privileges')
  revalidatePath('/privileges')
  return NextResponse.json({ success: true })
}
