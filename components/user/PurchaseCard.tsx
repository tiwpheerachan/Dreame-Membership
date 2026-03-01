import type { PurchaseRegistration } from '@/lib/types'
import { CHANNEL_LABELS, STATUS_LABELS } from '@/lib/types'
import { formatDate, formatCurrency } from '@/lib/utils'
import { getDaysUntilExpiry, isWarrantyValid } from '@/lib/points'
import { Badge } from '@/components/ui/index'
import { Package, Calendar, Shield } from 'lucide-react'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold'> = {
  PENDING_BQ: 'warning',
  BQ_VERIFIED: 'info',
  PENDING_ADMIN: 'warning',
  ADMIN_APPROVED: 'success',
  REJECTED: 'danger',
}

interface PurchaseCardProps {
  purchase: PurchaseRegistration
  onClick?: () => void
}

export function PurchaseCard({ purchase, onClick }: PurchaseCardProps) {
  const warrantyValid = isWarrantyValid(purchase.warranty_expires_at)
  const daysLeft = getDaysUntilExpiry(purchase.warranty_expires_at)

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-dreame-200 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-dreame-50 rounded-xl flex items-center justify-center">
            <Package size={20} className="text-dreame-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm line-clamp-1">
              {purchase.model_name || purchase.item_name || purchase.sku || 'สินค้า Dreame'}
            </p>
            <p className="text-xs text-gray-500">{purchase.order_sn}</p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[purchase.status]}>
          {STATUS_LABELS[purchase.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-50">
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Calendar size={11} /> วันที่ซื้อ
          </p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">
            {formatDate(purchase.purchase_date)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">ช่องทาง</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">
            {CHANNEL_LABELS[purchase.channel]}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Shield size={11} /> ประกัน
          </p>
          {purchase.warranty_expires_at ? (
            <p className={`text-xs font-medium mt-0.5 ${warrantyValid ? 'text-green-600' : 'text-red-500'}`}>
              {warrantyValid
                ? daysLeft && daysLeft <= 30
                  ? `เหลือ ${daysLeft} วัน`
                  : formatDate(purchase.warranty_expires_at)
                : 'หมดอายุแล้ว'}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">-</p>
          )}
        </div>
      </div>

      {purchase.points_awarded > 0 && (
        <div className="mt-3 flex items-center gap-1.5 bg-dreame-50 rounded-lg px-3 py-1.5">
          <span className="text-dreame-500">⭐</span>
          <span className="text-xs font-medium text-dreame-700">
            ได้รับ {purchase.points_awarded} คะแนน
          </span>
        </div>
      )}
    </div>
  )
}
