import { createServiceClient } from '@/lib/supabase/server'
import PendingList, { type PendingPurchase } from '@/components/admin/PendingList'

// Force fresh data on every request — admins expect newly registered
// pending purchases to appear here immediately, not after the cache TTL.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PendingPage() {
  const supabase = createServiceClient()
  // Disambiguate the users embed: older DBs have FKs both from user_id AND
  // approved_by to users(id), which makes PostgREST refuse the implicit join.
  const { data: pending } = await supabase
    .from('purchase_registrations')
    .select('*, users!purchase_registrations_user_id_fkey(full_name, phone, member_id)')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })

  return <PendingList initialItems={(pending || []) as unknown as PendingPurchase[]} />
}