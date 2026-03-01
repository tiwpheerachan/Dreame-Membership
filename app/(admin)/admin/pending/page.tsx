import { createServiceClient } from '@/lib/supabase/server'
import { formatDate, channelLabel } from '@/lib/utils'
import ApprovePurchaseButtons from '@/components/admin/ApprovePurchaseButtons'
import { Clock } from 'lucide-react'

type PendingUser = {
  full_name: string | null
  phone: string | null
  member_id: string | null
}

type PendingPurchase = {
  id: string
  order_sn: string
  model_name: string | null
  channel: string
  created_at: string
  serial_number: string | null
  total_amount: number | null
  receipt_image_url: string | null
  users: PendingUser
}

export default async function PendingPage() {
  const supabase = createServiceClient()

  const { data: pending } = await supabase
    .from('purchase_registrations')
    .select('*, users!inner(full_name, phone, member_id)')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-white text-2xl font-bold">รอตรวจสอบ</h1>
        <p className="text-gray-400 text-sm">{pending?.length || 0} รายการ</p>
      </div>

      {(!pending || pending.length === 0) ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <Clock size={40} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">ไม่มีรายการรอดำเนินการ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(pending as unknown as PendingPurchase[]).map((p) => (
            <div key={p.id} className="bg-gray-900 border border-amber-800/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{p.model_name || `Order: ${p.order_sn}`}</p>
                  <p className="text-gray-500 text-xs font-mono">{p.order_sn}</p>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs bg-amber-900/20 border border-amber-800/40 px-2 py-1 rounded-full">
                  <Clock size={12} /> รอตรวจสอบ
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">สมาชิก</p>
                  <p className="text-gray-300">{p.users?.full_name || '-'}</p>
                  <p className="text-gray-500 font-mono text-xs">{p.users?.member_id || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">เบอร์โทร</p>
                  <p className="text-gray-300">{p.users?.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">ช่องทาง</p>
                  <p className="text-gray-300">{channelLabel(p.channel)}</p>
                </div>
                <div>
                  <p className="text-gray-500">วันที่กรอก</p>
                  <p className="text-gray-300">{formatDate(p.created_at)}</p>
                </div>
                {p.serial_number && (
                  <div>
                    <p className="text-gray-500">Serial No.</p>
                    <p className="text-gray-300 font-mono">{p.serial_number}</p>
                  </div>
                )}
                {p.total_amount && p.total_amount > 0 && (
                  <div>
                    <p className="text-gray-500">ยอดรวม</p>
                    <p className="text-gray-300">฿{p.total_amount.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {p.receipt_image_url && (
                <a href={p.receipt_image_url} target="_blank" rel="noopener noreferrer"
                  className="block text-amber-400 text-xs hover:underline">
                  📄 ดูรูปใบเสร็จ →
                </a>
              )}

              <ApprovePurchaseButtons purchaseId={p.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}