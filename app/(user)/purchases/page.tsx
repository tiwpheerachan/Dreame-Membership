import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Package, Plus, Shield, Clock, CheckCircle,
  XCircle, AlertCircle, Star, CalendarDays,
  Hash, ShoppingBag, Globe, Music, Store
} from 'lucide-react'
import type { PurchaseRegistration } from '@/types'
import { formatDate, warrantyDaysLeft } from '@/lib/utils'

const CSS = `
  .pw { min-height:100vh; background:#f5f5f3; }

  /* HEADER */
  .pw-hdr { background:#0d0d0d; padding:52px 20px 32px; position:relative; overflow:hidden; }
  .pw-hdr::before { content:''; position:absolute; top:-80px; right:-60px; width:260px; height:260px;
    border-radius:50%; background:radial-gradient(circle,rgba(212,175,55,0.14) 0%,transparent 65%); }
  .pw-hdr-line { position:absolute; top:0; left:0; right:0; height:1px;
    background:linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent); }

  /* BODY */
  .pw-body { padding:16px; display:flex; flex-direction:column; gap:10px; }

  /* CARD */
  .pc { background:#fff; border-radius:18px; box-shadow:0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); overflow:hidden; }
  .pc-inner { padding:18px; }

  /* STATUS BADGES */
  .b-ok { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px;
    background:#f0fdf4; color:#16a34a; font-size:11px; font-weight:700; white-space:nowrap; }
  .b-pe { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px;
    background:#fffbeb; color:#d97706; font-size:11px; font-weight:700; white-space:nowrap; }
  .b-re { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px;
    background:#fef2f2; color:#dc2626; font-size:11px; font-weight:700; white-space:nowrap; }
  .b-df { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px;
    background:#f9fafb; color:#6b7280; font-size:11px; font-weight:700; white-space:nowrap; }

  /* META */
  .meta { display:flex; flex-wrap:wrap; gap:5px; margin-top:12px; }
  .chip { display:inline-flex; align-items:center; gap:4px; padding:4px 9px;
    border-radius:8px; font-size:11px; font-weight:500;
    background:#f5f5f3; color:#6b7280; }
  .chip-gold { background:#fffbeb; color:#92600a; font-weight:700; }

  /* DIVIDER */
  .div { height:1px; background:#f5f5f3; margin:14px 0; }

  /* WARRANTY */
  .wrow { display:flex; align-items:center; gap:10px; }
  .wdays { margin-left:auto; font-size:11px; font-weight:700;
    color:#15803d; padding:3px 10px; border-radius:100px;
    background:#f0fdf4; flex-shrink:0; }

  /* PENDING */
  .pnote { display:flex; align-items:center; gap:8px; margin-top:12px;
    padding:10px 12px; border-radius:10px; background:#fffbeb; }

  /* EMPTY */
  .pw-empty { background:#fff; border-radius:18px; padding:52px 24px; text-align:center;
    box-shadow:0 1px 4px rgba(0,0,0,0.06); }
`

const CH: Record<string, { icon: React.ReactNode; label: string }> = {
  SHOPEE:  { icon:<ShoppingBag size={10}/>, label:'Shopee'   },
  LAZADA:  { icon:<ShoppingBag size={10}/>, label:'Lazada'   },
  WEBSITE: { icon:<Globe size={10}/>,       label:'Website'  },
  TIKTOK:  { icon:<Music size={10}/>,       label:'TikTok'   },
  STORE:   { icon:<Store size={10}/>,       label:'หน้าร้าน' },
  OTHER:   { icon:<Package size={10}/>,     label:'อื่นๆ'    },
}

function Badge({ status }: { status: string }) {
  if (status === 'ADMIN_APPROVED') return <span className="b-ok"><CheckCircle size={11}/>ยืนยันแล้ว</span>
  if (status === 'PENDING')        return <span className="b-pe"><AlertCircle size={11}/>รอตรวจสอบ</span>
  if (status === 'REJECTED')       return <span className="b-re"><XCircle size={11}/>ไม่อนุมัติ</span>
  return <span className="b-df">{status}</span>
}

export default async function PurchasesPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: purchases } = await supabase
    .from('purchase_registrations').select('*')
    .eq('user_id', session.user.id).order('created_at', { ascending: false })

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pw">

        {/* Header */}
        <div className="pw-hdr">
          <div className="pw-hdr-line"/>
          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ color:'rgba(255,255,255,0.38)', fontSize:10, margin:'0 0 4px', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                ประวัติ & ประกัน
              </p>
              <h1 style={{ color:'#fff', fontSize:22, fontWeight:800, margin:0 }}>สินค้าของฉัน</h1>
              {purchases && purchases.length > 0 && (
                <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12, margin:'5px 0 0' }}>
                  {purchases.length} รายการ
                </p>
              )}
            </div>
            <Link href="/purchases/register" style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'11px 16px',
              background:'linear-gradient(135deg,#b8860b,#d4af37,#f5d060)',
              color:'#0d0d0d', borderRadius:12, fontSize:13, fontWeight:800,
              textDecoration:'none', boxShadow:'0 4px 16px rgba(212,175,55,0.3)'
            }}>
              <Plus size={14}/> ลงทะเบียน
            </Link>
          </div>
        </div>

        {/* Cards */}
        <div className="pw-body">
          {!purchases || purchases.length === 0 ? (
            <div className="pw-empty">
              <div style={{ width:56, height:56, borderRadius:16, background:'#f5f5f3',
                display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <Package size={26} color="#d1d5db"/>
              </div>
              <p style={{ color:'#111', fontSize:15, fontWeight:700, margin:'0 0 6px' }}>ยังไม่มีสินค้า</p>
              <p style={{ color:'#9ca3af', fontSize:13, margin:'0 0 22px', lineHeight:1.6 }}>
                ลงทะเบียนสินค้าเพื่อรับแต้มสะสมและรับประกัน
              </p>
              <Link href="/purchases/register" style={{
                display:'inline-flex', alignItems:'center', gap:6,
                padding:'11px 22px', background:'#0d0d0d', color:'#d4af37',
                borderRadius:12, fontSize:13, fontWeight:700, textDecoration:'none'
              }}>
                <Plus size={14}/> ลงทะเบียนสินค้า
              </Link>
            </div>
          ) : (purchases as PurchaseRegistration[]).map(p => {
            const daysLeft = warrantyDaysLeft(p.warranty_end)
            const wOk = daysLeft > 0
            const ch = CH[p.channel] || CH.OTHER

            return (
              <div key={p.id} className="pc">
                <div className="pc-inner">

                  {/* Top */}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:14, fontWeight:700, color:'#111', margin:'0 0 3px',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.model_name || p.order_sn}
                      </p>
                      <p style={{ fontSize:10, color:'#bbb', margin:0, fontFamily:'monospace', letterSpacing:'0.04em' }}>
                        {p.order_sn}
                      </p>
                    </div>
                    <Badge status={p.status}/>
                  </div>

                  {/* Meta */}
                  <div className="meta">
                    <span className="chip">{ch.icon}&nbsp;{ch.label}</span>
                    {p.purchase_date && (
                      <span className="chip"><CalendarDays size={10}/>&nbsp;{formatDate(p.purchase_date)}</span>
                    )}
                    {p.serial_number && (
                      <span className="chip"><Hash size={10}/>&nbsp;{p.serial_number}</span>
                    )}
                    {p.points_awarded > 0 && (
                      <span className="chip chip-gold">
                        <Star size={10} fill="currentColor"/>&nbsp;+{p.points_awarded} แต้ม
                      </span>
                    )}
                  </div>

                  {/* Warranty */}
                  {p.warranty_end && (
                    <>
                      <div className="div"/>
                      <div className="wrow">
                        <Shield size={15} color={wOk ? '#16a34a' : '#d1d5db'}/>
                        <div>
                          <p style={{ fontSize:12, fontWeight:600,
                            color: wOk ? '#15803d' : '#9ca3af', margin:'0 0 1px', lineHeight:1 }}>
                            {wOk ? 'ประกันยังมีผล' : 'ประกันหมดอายุ'}
                          </p>
                          <p style={{ fontSize:10, color:'#bbb', margin:0 }}>
                            ถึง {formatDate(p.warranty_end)}
                          </p>
                        </div>
                        {wOk && <span className="wdays">{daysLeft} วัน</span>}
                      </div>
                    </>
                  )}

                  {/* Pending */}
                  {p.status === 'PENDING' && (
                    <div className="pnote">
                      <Clock size={13} color="#d97706"/>
                      <p style={{ fontSize:11, color:'#92400e', margin:0 }}>
                        กำลังตรวจสอบ · อาจใช้เวลาสูงสุด 6 ชั่วโมง
                      </p>
                    </div>
                  )}

                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}