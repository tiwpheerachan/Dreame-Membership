import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Tag } from 'lucide-react'
import type { Coupon } from '@/types'
import CouponCard from '@/components/user/CouponCard'

const CSS = `
  .cpw { padding:0 0 16px; }
  .cp-hdr { background:#0d0d0d; padding:48px 20px 28px; position:relative; overflow:hidden; }
  .cp-hdr::before { content:''; position:absolute; top:-60px; right:-60px; width:200px; height:200px; border-radius:50%; background:radial-gradient(circle,rgba(212,175,55,0.15) 0%,transparent 70%); }
  .cp-hdr-line { position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(212,175,55,0.4),transparent); }
  .cp-body { padding:16px; display:flex; flex-direction:column; gap:16px; }
  .cp-sec-title { font-size:12px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 8px; display:flex; align-items:center; gap:6px; }
  .cp-empty { background:#fff; border-radius:18px; padding:48px 24px; text-align:center; box-shadow:0 1px 6px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.04); }
`

export default async function CouponsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const { data: coupons } = await supabase
    .from('coupons').select('*').eq('user_id', session.user.id)
    .order('valid_until', { ascending: true })

  const active  = (coupons||[]).filter((c: Coupon) => !c.used_at && c.valid_until >= today)
  const used    = (coupons||[]).filter((c: Coupon) => c.used_at)
  const expired = (coupons||[]).filter((c: Coupon) => !c.used_at && c.valid_until < today)

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cpw">
        <div className="cp-hdr">
          <div className="cp-hdr-line" />
          <div style={{ position:'relative', zIndex:1 }}>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, margin:'0 0 3px', letterSpacing:'0.06em', textTransform:'uppercase' }}>สิทธิพิเศษ</p>
            <h1 style={{ color:'#fff', fontSize:20, fontWeight:700, margin:0 }}>คูปองของฉัน</h1>
          </div>
        </div>

        <div className="cp-body">
          {active.length === 0 && used.length === 0 && expired.length === 0 ? (
            <div className="cp-empty">
              <div style={{ width:60, height:60, borderRadius:18, background:'#f7f7f5', border:'1px solid #f0f0ee', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <Tag size={26} color="#d1d5db"/>
              </div>
              <p style={{ color:'#374151', fontSize:15, fontWeight:600, margin:'0 0 6px' }}>ยังไม่มีคูปอง</p>
              <p style={{ color:'#9ca3af', fontSize:12, margin:0 }}>คูปองจะปรากฏที่นี่เมื่อได้รับจาก Dreame</p>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div>
                  <p className="cp-sec-title">
                    <span style={{ width:6, height:6, borderRadius:50, background:'#16a34a', display:'inline-block' }}/>
                    ใช้ได้ ({active.length})
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {active.map((c: Coupon) => <CouponCard key={c.id} coupon={c} status="active"/>)}
                  </div>
                </div>
              )}
              {used.length > 0 && (
                <div>
                  <p className="cp-sec-title">
                    <span style={{ width:6, height:6, borderRadius:50, background:'#6b7280', display:'inline-block' }}/>
                    ใช้แล้ว ({used.length})
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, opacity:0.55 }}>
                    {used.map((c: Coupon) => <CouponCard key={c.id} coupon={c} status="used"/>)}
                  </div>
                </div>
              )}
              {expired.length > 0 && (
                <div>
                  <p className="cp-sec-title">
                    <span style={{ width:6, height:6, borderRadius:50, background:'#dc2626', display:'inline-block' }}/>
                    หมดอายุ ({expired.length})
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, opacity:0.5 }}>
                    {expired.map((c: Coupon) => <CouponCard key={c.id} coupon={c} status="expired"/>)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}