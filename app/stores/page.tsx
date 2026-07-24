// ============================================================
// PUBLIC store-locator landing (ไม่ต้อง login) — ปลายทางสำหรับแอด CPAS ฝั่งออฟไลน์
// เส้นทาง /stores ไม่อยู่ใน middleware matcher → เปิดได้โดยไม่ต้องล็อกอิน
// branches: RLS public-read (active) — ใช้ service client ให้เรนเดอร์ได้เสมอ
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import Script from 'next/script'
import Link from 'next/link'
import { Store, MapPin, ArrowRight, Sparkles } from 'lucide-react'
import type { Branch } from '@/types'
import BranchCard from '@/components/user/BranchCard'

const SIGNUP_HREF = '/login?mode=register'

export const metadata = {
  title: 'สาขา Dreame — ค้นหาร้านใกล้คุณ',
  description: 'รวมสาขา Dreame ออฟไลน์ทั่วประเทศ — ที่อยู่ เวลาเปิด-ปิด และนำทางไปยังร้านได้ทันที',
  openGraph: {
    title: 'สาขา Dreame — ค้นหาร้านใกล้คุณ',
    description: 'รวมสาขา Dreame ออฟไลน์ทั่วประเทศ — ที่อยู่ เวลาเปิด-ปิด และนำทางไปยังร้าน',
  },
}

// อัปเดตข้อมูลสาขาให้สดใหม่เสมอ (ไม่ cache นาน — แอดมินแก้แล้วเห็นทันที)
export const revalidate = 60

export default async function StoresPage() {
  const service = createServiceClient()
  const { data: branches } = await service
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })

  const list = (branches || []) as Branch[]
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      {/* Meta Pixel — ทำงานเมื่อมี NEXT_PUBLIC_META_PIXEL_ID (ใส่ทีหลังได้สำหรับ CPAS) */}
      {pixelId && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${pixelId}');fbq('track','PageView');
          `}</Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: 'none' }} alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
          </noscript>
        </>
      )}

      {/* Hero — พื้นครีมสว่าง + DREAME wordmark ดำ + ทองพรีเมียม */}
      <header style={{
        padding: '54px 24px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(130% 92% at 50% -12%, #FFFFFF 0%, #FBF7EF 52%, #F2E9D5 100%)',
        borderBottom: '1px solid rgba(160,120,43,0.16)',
      }}>
        {/* soft gold glow */}
        <div aria-hidden style={{
          position: 'absolute', top: -110, left: '50%', transform: 'translateX(-50%)',
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,160,99,0.20), transparent 70%)', pointerEvents: 'none',
        }} />

        {/* DREAME wordmark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dreame-wordmark.png" alt="DREAME" style={{
          position: 'relative', width: 208, maxWidth: '62%', height: 'auto',
          margin: '0 auto 20px', display: 'block',
        }} />

        <div style={{ width: 40, height: 3, borderRadius: 2, margin: '0 auto 16px', background: 'linear-gradient(90deg,#EADBB1,#C9A063)' }} />

        <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.26em', textTransform: 'uppercase', color: '#A0782B', fontWeight: 800 }}>
          Official Stores
        </p>
        <h1 style={{ margin: '10px 0 0', fontSize: 31, lineHeight: 1.12, fontWeight: 800, color: '#1A1815', letterSpacing: '-0.01em' }}>
          ค้นหาสาขา<span className="serif-i" style={{ fontWeight: 400 }}>ใกล้คุณ</span>
        </h1>

        {/* CTA เด่น — ดำ-ทอง ตัดกับพื้นครีม */}
        <Link href={SIGNUP_HREF} className="tap" style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 22,
          padding: '15px 30px', borderRadius: 'var(--r-pill,999px)',
          background: 'linear-gradient(180deg,#2A2620 0%,#141210 100%)',
          color: 'var(--gold-soft,#E0C173)', fontSize: 15, fontWeight: 800, textDecoration: 'none',
          boxShadow: '0 10px 26px rgba(20,18,15,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <Sparkles size={16} strokeWidth={2.4} /> สมัครสมาชิก Dreame ฟรี <ArrowRight size={16} strokeWidth={2.6} />
        </Link>
        <p style={{ margin: '12px auto 0', fontSize: 11.5, color: 'var(--ink-faint,#9a9a9a)', maxWidth: 320, lineHeight: 1.5 }}>
          ลงทะเบียนรับประกันสินค้า · สะสมแต้ม · รับสิทธิพิเศษเฉพาะสมาชิก
        </p>
      </header>

      {/* Branch list */}
      {list.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-mute)' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%',
            background: 'linear-gradient(135deg,#FAF3DC,#EADBB1)', color: '#A0782B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Store size={26} strokeWidth={1.4} />
          </div>
          <p style={{ margin: 0, fontSize: 13 }}>ยังไม่มีข้อมูลสาขา</p>
        </div>
      ) : (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.map(b => <BranchCard key={b.id} branch={b} />)}
        </div>
      )}

      {/* Footer */}
      <footer style={{ padding: '24px 20px 40px', textAlign: 'center', borderTop: '1px solid var(--hair,#eee)' }}>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-faint,#999)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={12} /> Dreame Thailand · ช้อปที่สาขาใกล้บ้านคุณ
        </p>
      </footer>

      {/* Sticky bottom CTA — เห็นตลอด ดันคนสมัครสมาชิก */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--hair,#eee)', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      }}>
        <Link href={SIGNUP_HREF} className="tap" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          maxWidth: 608, margin: '0 auto',
          padding: '15px 20px', borderRadius: 'var(--r-pill,999px)',
          background: 'linear-gradient(180deg,#2A2620 0%,#1A1815 100%)',
          color: 'var(--gold-soft,#E0C173)', fontSize: 15, fontWeight: 800, textDecoration: 'none',
          boxShadow: '0 6px 18px rgba(20,18,15,0.28)',
        }}>
          <Sparkles size={16} strokeWidth={2.4} /> สมัครสมาชิก · รับสิทธิพิเศษ <ArrowRight size={16} strokeWidth={2.6} />
        </Link>
      </div>
    </div>
  )
}
