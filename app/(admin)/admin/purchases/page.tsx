import { createServiceClient } from '@/lib/supabase/server'
import OrdersTable, { type OrderRow } from '@/components/admin/OrdersTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SearchParams {
  q?: string; status?: string; channel?: string;
  from?: string; to?: string; page?: string;
}

export default async function PurchasesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient()
  const q       = searchParams.q || ''
  const status  = searchParams.status || ''
  const channel = searchParams.channel || ''
  const from    = searchParams.from || ''
  const to      = searchParams.to || ''
  const page    = parseInt(searchParams.page || '1')
  const pageSize = 30

  // Older DBs have an extra FK from `approved_by` → users.id (in addition to
  // the canonical user_id → users.id). PostgREST refuses ambiguous embeds, so
  // we name the FK explicitly. SELECT * + left-join keeps us tolerant of
  // missing columns / orphan rows.
  let query = supabase
    .from('purchase_registrations')
    .select(
      '*, users!purchase_registrations_user_id_fkey(member_id, full_name, phone)',
      { count: 'exact' },
    )

  if (q)       query = query.or(`order_sn.ilike.%${q}%,serial_number.ilike.%${q}%,model_name.ilike.%${q}%,invoice_no.ilike.%${q}%`)
  if (status)  query = query.eq('status', status)
  if (channel) query = query.eq('channel', channel)
  if (from)    query = query.gte('created_at', from)
  if (to)      query = query.lte('created_at', to)

  const { data: purchases, count, error } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) {
    // Surface server-side errors so we can diagnose missing columns / RLS
    // / FK issues instead of silently rendering an empty table.
    console.error('[admin/purchases] items query error:', error)
  }

  // Status counts respect the active search/channel/date filters but ignore
  // the status chip itself — so each chip shows how many rows would appear
  // if you clicked it.
  function buildCountQuery(s: string | null) {
    let cq = supabase
      .from('purchase_registrations')
      .select('id', { count: 'exact', head: true })
    if (q)       cq = cq.or(`order_sn.ilike.%${q}%,serial_number.ilike.%${q}%,model_name.ilike.%${q}%,invoice_no.ilike.%${q}%`)
    if (channel) cq = cq.eq('channel', channel)
    if (from)    cq = cq.gte('created_at', from)
    if (to)      cq = cq.lte('created_at', to)
    if (s)       cq = cq.eq('status', s)
    return cq
  }
  const [
    { count: cAll },
    { count: cPending },
    { count: cBQ },
    { count: cApproved },
    { count: cRejected },
  ] = await Promise.all([
    buildCountQuery(null),
    buildCountQuery('PENDING'),
    buildCountQuery('BQ_VERIFIED'),
    buildCountQuery('ADMIN_APPROVED'),
    buildCountQuery('REJECTED'),
  ])

  return (
    <OrdersTable
      initialItems={(purchases || []) as unknown as OrderRow[]}
      totalCount={count || 0}
      statusCounts={{
        all: cAll || 0,
        PENDING: cPending || 0,
        BQ_VERIFIED: cBQ || 0,
        ADMIN_APPROVED: cApproved || 0,
        REJECTED: cRejected || 0,
      }}
      page={page}
      pageSize={pageSize}
    />
  )
}
