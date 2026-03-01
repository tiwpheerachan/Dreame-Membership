'use client'
import type { Coupon } from '@/types'
import { formatDate } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface Props { coupon: Coupon; status: 'active' | 'used' | 'expired' }

export default function CouponCard({ coupon, status }: Props) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(coupon.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const discountLabel = coupon.discount_type === 'PERCENT'
    ? `ลด ${coupon.discount_value}%`
    : `ลด ฿${Number(coupon.discount_value).toLocaleString()}`

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden ${status === 'active' ? 'border-amber-500/40' : 'border-gray-800'}`}>
      <div className="flex">
        {/* Left discount display */}
        <div className={`w-24 flex-shrink-0 flex flex-col items-center justify-center p-3 ${status === 'active' ? 'bg-amber-500/20' : 'bg-gray-800'}`}>
          <span className={`text-lg font-black ${status === 'active' ? 'text-amber-400' : 'text-gray-500'}`}>
            {coupon.discount_type === 'PERCENT' ? `${coupon.discount_value}%` : `฿${coupon.discount_value}`}
          </span>
          <span className={`text-xs ${status === 'active' ? 'text-amber-300/70' : 'text-gray-600'}`}>ส่วนลด</span>
        </div>

        {/* Divider */}
        <div className="flex flex-col justify-center">
          {Array.from({length:6}).map((_,i) => (
            <div key={i} className={`w-0.5 h-1 my-0.5 ${status === 'active' ? 'bg-amber-500/30' : 'bg-gray-700'}`} />
          ))}
        </div>

        {/* Right details */}
        <div className="flex-1 p-3">
          <p className="text-white font-semibold text-sm">{coupon.title || discountLabel}</p>
          {coupon.description && <p className="text-gray-400 text-xs mt-0.5">{coupon.description}</p>}
          {coupon.min_purchase > 0 && (
            <p className="text-gray-500 text-xs mt-1">ยอดขั้นต่ำ ฿{Number(coupon.min_purchase).toLocaleString()}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-gray-600 text-xs">หมดอายุ {formatDate(coupon.valid_until)}</p>
              <p className="text-gray-400 text-xs font-mono mt-0.5 bg-gray-800 px-2 py-0.5 rounded">{coupon.code}</p>
            </div>
            {status === 'active' && (
              <button onClick={copy} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors">
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'คัดลอก!' : 'คัดลอก'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
