import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, Plus, Clock, Shield } from 'lucide-react'
import type { PurchaseRegistration } from '@/types'
import { formatDate, statusLabel, statusColor, channelLabel, warrantyDaysLeft } from '@/lib/utils'

export default async function PurchasesPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: purchases } = await supabase
    .from('purchase_registrations')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-white text-xl font-bold">ประวัติ & ประกัน</h1>
        <Link href="/purchases/register"
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-gray-900 text-sm font-semibold px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> ลงทะเบียน
        </Link>
      </div>

      {!purchases || purchases.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400">ยังไม่มีประวัติการซื้อ</p>
          <p className="text-gray-600 text-sm mt-1">ลงทะเบียนสินค้าเพื่อรับคะแนนสะสมและประกันสินค้า</p>
          <Link href="/purchases/register" className="mt-4 inline-block bg-amber-500 text-gray-900 px-6 py-2.5 rounded-lg font-semibold text-sm">
            ลงทะเบียนสินค้า
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(purchases as PurchaseRegistration[]).map(p => {
            const daysLeft = warrantyDaysLeft(p.warranty_end)
            const warrantyActive = daysLeft > 0
            return (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{p.model_name || `Order: ${p.order_sn}`}</p>
                    <p className="text-gray-500 text-xs mt-0.5 font-mono">{p.order_sn}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border flex-shrink-0 ${statusColor(p.status)}`}>
                    {p.status === 'PENDING' ? '⏳ ' : '✓ '}{statusLabel(p.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">วันที่ซื้อ</span>
                    <p className="text-gray-300">{formatDate(p.purchase_date || p.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">ช่องทาง</span>
                    <p className="text-gray-300">{channelLabel(p.channel)}</p>
                  </div>
                  {p.serial_number && (
                    <div>
                      <span className="text-gray-500">Serial No.</span>
                      <p className="text-gray-300 font-mono">{p.serial_number}</p>
                    </div>
                  )}
                  {p.sku && (
                    <div>
                      <span className="text-gray-500">SKU</span>
                      <p className="text-gray-300 font-mono">{p.sku}</p>
                    </div>
                  )}
                </div>

                {/* Warranty bar */}
                {p.warranty_end && (
                  <div className={`flex items-center gap-2 rounded-lg p-2.5 ${warrantyActive ? 'bg-green-900/20 border border-green-800/40' : 'bg-gray-800/50 border border-gray-700/40'}`}>
                    <Shield size={14} className={warrantyActive ? 'text-green-400' : 'text-gray-500'} />
                    <div className="flex-1">
                      <p className={`text-xs font-medium ${warrantyActive ? 'text-green-400' : 'text-gray-500'}`}>
                        {warrantyActive ? `ประกันคงเหลือ ${daysLeft} วัน` : 'ประกันหมดอายุแล้ว'}
                      </p>
                      <p className="text-gray-600 text-xs">ถึง {formatDate(p.warranty_end)}</p>
                    </div>
                    {p.points_awarded > 0 && (
                      <span className="text-amber-400 text-xs font-semibold">+{p.points_awarded} แต้ม</span>
                    )}
                  </div>
                )}

                {p.status === 'PENDING' && (
                  <div className="flex items-center gap-2 text-xs text-yellow-400/80 bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-2">
                    <Clock size={12} />
                    <span>กำลังตรวจสอบคำสั่งซื้อ อาจใช้เวลาสูงสุด 6 ชั่วโมง</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
