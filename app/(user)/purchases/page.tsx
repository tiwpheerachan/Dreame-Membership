import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, Plus, Shield, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react'
import type { PurchaseRegistration } from '@/types'
import { formatDate, channelLabel, warrantyDaysLeft } from '@/lib/utils'

const CSS = `
  .pw { padding:0 0 16px; }
  .pw-hdr { background:#0d0d0d; padding:48px 20px 28px; position:relative; overflow:hidden; }
  .pw-hdr::before { content:''; position:absolute; top:-60px; right:-60px; width:200px; height:200px; border-radius:50%; background:radial-gradient(circle,rgba(212,175,55,0.15) 0%,transparent 70%); }
  .pw-hdr-line { position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(212,175,55,0.4),transparent); }
  .pw-body { padding:16px; display:flex; flex-direction:column; gap:10px; }
  .pcard { background:#fff; border-radius:18px; overflow:hidden; box-shadow:0 1px 6px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.04); }
  .pcard-top { padding:14px 16px 10px; display:flex; align-items:flex-start; gap:12px; }
  .pcard-ico { width:40px; height:40px; border-radius:12px; background:#f7f7f5; border:1px solid #f0f0ee; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .pcard-body { flex:1; min-width:0; }
  .pcard-chips { display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 10px; }
  .chip { display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:100px; font-size:10px; font-weight:500; background:#f7f7f5; color:#6b7280; border:1px solid #f0f0ee; }
  .warranty-ok  { padding:10px 16px; border-top:1px solid #f7f7f5; display:flex; align-items:center; gap:8px; background:#f0fdf4; }
  .warranty-exp { padding:10px 16px; border-top:1px solid #f7f7f5; display:flex; align-items:center; gap:8px; background:#fafafa; }
  .pending-note { padding:8px 16px 12px; display:flex; align-items:center; gap:6px; }
  .badge-ap { display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:100px; background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; font-size:10px; font-weight:600; white-space:nowrap; }
  .badge-pe { display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:100px; background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-size:10px; font-weight:600; white-space:nowrap; }
  .badge-re { display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:100px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-size:10px; font-weight:600; white-space:nowrap; }
  .badge-df { display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:100px; background:#f3f4f6; color:#6b7280; border:1px solid #e5e7eb; font-size:10px; font-weight:600; white-space:nowrap; }
  .empty-box { background:#fff; border-radius:18px; padding:48px 24px; text-align:center; box-shadow:0 1px 6px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.04); }
  .reg-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; background:#0d0d0d; color:#d4af37; border-radius:12px; font-size:13px; font-weight:700; text-decoration:none; border:1px solid rgba(212,175,55,0.3); }
`

function StatusBadge({ status }: { status: string }) {
  if (status === 'ADMIN_APPROVED') return <span className="badge-ap"><CheckCircle size={10}/>ยืนยันแล้ว</span>
  if (status === 'PENDING') return <span className="badge-pe"><AlertCircle size={10}/>รอตรวจสอบ</span>
  if (status === 'REJECTED') return <span className="badge-re"><XCircle size={10}/>ปฏิเสธ</span>
  return <span className="badge-df">{status}</span>
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
          <div className="pw-hdr-line" />
          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, margin:'0 0 3px', letterSpacing:'0.06em', textTransform:'uppercase' }}>ประวัติ & ประกัน</p>
              <h1 style={{ color:'#fff', fontSize:20, fontWeight:700, margin:0 }}>สินค้าของฉัน</h1>
            </div>
            <Link href="/purchases/register" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 14px', background:'linear-gradient(135deg,#d4af37,#f5d060)', color:'#0d0d0d', borderRadius:12, fontSize:12, fontWeight:700, textDecoration:'none' }}>
              <Plus size={14}/> ลงทะเบียน
            </Link>
          </div>
        </div>

        {/* Body */}
        <div className="pw-body">
          {!purchases || purchases.length === 0 ? (
            <div className="empty-box">
              <div style={{ width:60, height:60, borderRadius:18, background:'#f7f7f5', border:'1px solid #f0f0ee', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <Package size={26} color="#d1d5db"/>
              </div>
              <p style={{ color:'#374151', fontSize:15, fontWeight:600, margin:'0 0 6px' }}>ยังไม่มีสินค้า</p>
              <p style={{ color:'#9ca3af', fontSize:12, margin:'0 0 20px' }}>ลงทะเบียนสินค้าเพื่อรับแต้มและประกัน</p>
              <Link href="/purchases/register" className="reg-btn"><Plus size={14}/>ลงทะเบียนสินค้า</Link>
            </div>
          ) : (purchases as PurchaseRegistration[]).map(p => {
            const daysLeft = warrantyDaysLeft(p.warranty_end)
            const wOk = daysLeft > 0
            return (
              <div key={p.id} className="pcard">
                <div className="pcard-top">
                  <div className="pcard-ico"><Package size={18} color="#9ca3af"/></div>
                  <div className="pcard-body">
                    <p style={{ fontSize:13, fontWeight:700, color:'#111', margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {p.model_name || `Order: ${p.order_sn}`}
                    </p>
                    <p style={{ fontSize:10, color:'#9ca3af', margin:'0 0 6px', fontFamily:'monospace' }}>{p.order_sn}</p>
                    <StatusBadge status={p.status}/>
                  </div>
                </div>

                <div className="pcard-chips">
                  <span className="chip">{channelLabel(p.channel)}</span>
                  {p.purchase_date && <span className="chip"><Clock size={9}/>{formatDate(p.purchase_date)}</span>}
                  {p.serial_number && <span className="chip">S/N: {p.serial_number}</span>}
                  {p.points_awarded > 0 && <span className="chip" style={{ color:'#b8860b', borderColor:'#fde68a', background:'#fffbeb' }}>+{p.points_awarded} แต้ม</span>}
                </div>

                {p.warranty_end && (
                  <div className={wOk ? 'warranty-ok' : 'warranty-exp'}>
                    <Shield size={14} color={wOk ? '#16a34a' : '#9ca3af'}/>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:12, fontWeight:600, color: wOk ? '#15803d' : '#9ca3af', margin:0 }}>
                        {wOk ? `ประกันคงเหลือ ${daysLeft} วัน` : 'ประกันหมดอายุแล้ว'}
                      </p>
                      <p style={{ fontSize:10, color:'#9ca3af', margin:0 }}>ถึง {formatDate(p.warranty_end)}</p>
                    </div>
                  </div>
                )}

                {p.status === 'PENDING' && (
                  <div className="pending-note">
                    <AlertCircle size={12} color="#ca8a04"/>
                    <p style={{ fontSize:11, color:'#92400e', margin:0 }}>กำลังตรวจสอบ อาจใช้เวลาสูงสุด 6 ชั่วโมง</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}