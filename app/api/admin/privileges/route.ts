// GET /api/admin/privileges — รายการสิทธิรับน้ำยาฟรี (staff เท่านั้น)
//   ?q=<คำค้น>   ค้นด้วย เบอร์ / ชื่อ / transaction id / รุ่น
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

export async function GET(req: Request) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const q = new URL(req.url).searchParams.get('q')?.trim()

  let query = auth.service
    .from('refill_privileges')
    .select('*')
    .order('purchased_at', { ascending: false })
    .limit(500)

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
