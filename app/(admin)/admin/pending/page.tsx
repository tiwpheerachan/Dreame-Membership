import { createServiceClient } from '@/lib/supabase/server'
import PendingList, { type PendingPurchase } from '@/components/admin/PendingList'

export default async function PendingPage() {
  const supabase = createServiceClient()
  const { data: pending } = await supabase
    .from('purchase_registrations')
    .select('*, users!inner(full_name, phone, member_id)')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })

  return <PendingList initialItems={(pending || []) as unknown as PendingPurchase[]} />
}