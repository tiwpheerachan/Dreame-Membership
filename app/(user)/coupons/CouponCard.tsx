'use client'
import { useState } from 'react'
import type { Coupon } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'

export default function CouponCard({ coupon }: { coupon: Coupon }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const daysLeft = Math.ceil(
    (new Date(coupon.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Top stripe */}
      <div className="h-1.5 bg-gradient-to-r from-dreame-400 to-dreame-600" />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-gray-900">{coupon.title || 'ส่วนลดพิเศษ'}</p>
            {coupon.description && (
              <p className="text-xs text-gray-500 mt-0.5">{coupon.description}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-dreame-600">
              {coupon.discount_type === 'PERCENT'
                ? `${coupon.discount_value}%`
                : `฿${coupon.discount_value.toLocaleString()}`}
            </p>
            <p className="text-xs text-gray-400">
              {coupon.discount_type === 'PERCENT' ? 'ส่วนลด' : 'บาท'}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-3">
          <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gray-50 rounded-full border border-gray-100" />
          <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gray-50 rounded-full border border-gray-100" />
          <div className="border-t border-dashed border-gray-200" />
        </div>

        {/* Code + expiry */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <code className="bg-dreame-50 text-dreame-700 px-3 py-1.5 rounded-lg font-mono font-bold text-sm tracking-wider">
              {coupon.code}
            </code>
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 hover:bg-dreame-100 hover:text-dreame-600'}`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">ถึง {formatDate(coupon.valid_until)}</p>
            {daysLeft <= 7 && (
              <p className="text-xs font-semibold text-red-500">เหลือ {daysLeft} วัน!</p>
            )}
          </div>
        </div>

        {coupon.min_purchase > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            * ขั้นต่ำ {coupon.min_purchase.toLocaleString()} บาท
            {coupon.max_discount ? ` (สูงสุด ${coupon.max_discount.toLocaleString()} บาท)` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
