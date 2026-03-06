'use client'
import type { Coupon } from '@/types'
import { formatDate } from '@/lib/utils'
import { Copy, Check, Clock } from 'lucide-react'
import { useState } from 'react'

interface Props { coupon: Coupon; status: 'active' | 'used' | 'expired' }

export default function CouponCard({ coupon, status }: Props) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(coupon.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const discountText = coupon.discount_type === 'PERCENT'
    ? `${coupon.discount_value}%` : `฿${Number(coupon.discount_value).toLocaleString()}`

  const isActive = status === 'active'

  return (
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', border: isActive ? '1px solid rgba(212,175,55,0.3)' : '1px solid #f0f0ee', boxShadow: isActive ? '0 2px 12px rgba(212,175,55,0.08)' : '0 1px 4px rgba(0,0,0,0.04)', display:'flex' }}>
      {/* Left */}
      <div style={{ width:76, flexShrink:0, background: isActive ? '#0d0d0d' : '#f7f7f5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, padding:'12px 0' }}>
        <p style={{ fontSize:20, fontWeight:800, color: isActive ? '#d4af37' : '#9ca3af', margin:0, lineHeight:1 }}>{discountText}</p>
        <p style={{ fontSize:9, color: isActive ? 'rgba(212,175,55,0.6)' : '#c4c4c4', margin:0, letterSpacing:'0.06em', textTransform:'uppercase' }}>ส่วนลด</p>
      </div>

      {/* Dashed divider */}
      <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:3, padding:'0 1px' }}>
        {Array.from({length:7}).map((_,i)=>(
          <div key={i} style={{ width:2, height:4, background: isActive ? 'rgba(212,175,55,0.25)' : '#f0f0ee', borderRadius:1 }}/>
        ))}
      </div>

      {/* Right */}
      <div style={{ flex:1, padding:'12px 12px 12px 10px', minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:700, color:'#111', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {coupon.title || `ส่วนลด ${discountText}`}
        </p>
        {coupon.description && (
          <p style={{ fontSize:11, color:'#6b7280', margin:'0 0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{coupon.description}</p>
        )}
        {coupon.min_purchase > 0 && (
          <p style={{ fontSize:10, color:'#9ca3af', margin:'0 0 6px' }}>ขั้นต่ำ ฿{Number(coupon.min_purchase).toLocaleString()}</p>
        )}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:8, background:'#f7f7f5', border:'1px solid #f0f0ee' }}>
              <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:600, color:'#374151' }}>{coupon.code}</span>
            </div>
            <p style={{ fontSize:9, color:'#9ca3af', margin:'3px 0 0', display:'flex', alignItems:'center', gap:3 }}>
              <Clock size={9}/> หมดอายุ {formatDate(coupon.valid_until)}
            </p>
          </div>
          {isActive && (
            <button onClick={copy} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:10, background: copied ? '#f0fdf4' : '#0d0d0d', border: copied ? '1px solid #bbf7d0' : '1px solid transparent', color: copied ? '#16a34a' : '#d4af37', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.2s', flexShrink:0 }}>
              {copied ? <Check size={11}/> : <Copy size={11}/>}
              {copied ? 'คัดลอก!' : 'คัดลอก'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}