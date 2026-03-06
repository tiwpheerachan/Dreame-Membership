import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, Star, Tag, ChevronRight, Shield, Zap, Bell, TrendingUp, Plus } from 'lucide-react'
import type { User, PurchaseRegistration, Promotion } from '@/types'
import dynamic from 'next/dynamic'
const MemberCard = dynamic(() => import('@/components/user/MemberCard'), { ssr: false })
import { formatDate, statusLabel } from '@/lib/utils'

const CSS = `
  * { box-sizing:border-box; }
  .hw { background:#f0f0ee; min-height:100vh; font-family:'Prompt',system-ui,sans-serif; }

  /* HEADER */
  .hdr { background:#0d0d0d; padding:52px 20px 100px; position:relative; overflow:hidden; }
  .hdr-glow { position:absolute; top:-100px; right:-80px; width:320px; height:320px; border-radius:50%;
    background:radial-gradient(circle,rgba(212,175,55,0.15) 0%,transparent 65%); pointer-events:none; }
  .hdr-line { position:absolute; top:0; left:0; right:0; height:1px;
    background:linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent); }
  .hdr-grid { position:absolute; inset:0; opacity:0.04;
    background-image:linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px);
    background-size:28px 28px; pointer-events:none; }

  /* BODY WRAPPER - sits over header */
  .body { padding:0 16px 8px; margin-top:-72px; position:relative; z-index:2;
    display:flex; flex-direction:column; gap:12px; }

  /* STAT STRIP - inside/below card */
  .stat-strip { display:grid; grid-template-columns:1fr 1fr 1fr;
    background:#fff; border-radius:18px; overflow:hidden;
    box-shadow:0 2px 12px rgba(0,0,0,0.08); border:1px solid rgba(0,0,0,0.05); }
  .stat-item { padding:14px 10px; text-align:center; position:relative; }
  .stat-item:not(:last-child)::after { content:''; position:absolute; right:0; top:20%; bottom:20%; width:1px; background:#f0f0ee; }
  .stat-num { font-size:20px; font-weight:800; margin:0 0 2px; line-height:1; }
  .stat-lbl { font-size:9px; color:#9ca3af; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; margin:0; }

  /* PROGRESS */
  .prog-card { background:#fff; border-radius:18px; padding:14px 16px;
    box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.05); }
  .prog-track { height:6px; background:#f0f0ee; border-radius:100px; overflow:hidden; margin-top:10px; }
  .prog-fill  { height:100%; border-radius:100px;
    background:linear-gradient(90deg,#92600a,#d4af37,#f5d060); transition:width 0.8s ease; }

  /* ACTIONS */
  .act-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  .act-item { background:#fff; border-radius:16px; padding:14px 6px 12px;
    box-shadow:0 2px 10px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.05);
    text-decoration:none; display:flex; flex-direction:column; align-items:center; gap:8px;
    transition:transform 0.12s; }
  .act-item:active { transform:scale(0.95); }
  .act-ico { width:42px; height:42px; border-radius:13px; display:flex; align-items:center; justify-content:center; }
  .act-lbl { font-size:10px; font-weight:600; color:#374151; text-align:center; line-height:1.3; }

  /* SECTION HEADER */
  .sec-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .sec-title { font-size:15px; font-weight:700; color:#111; }
  .sec-link { font-size:11px; color:#b8860b; font-weight:600; text-decoration:none;
    display:flex; align-items:center; gap:2px; }

  /* PURCHASE LIST */
  .plist { background:#fff; border-radius:18px; overflow:hidden;
    box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.05); }
  .prow { display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:1px solid #f7f7f5; }
  .prow:last-child { border-bottom:none; }
  .prow-ico { width:38px; height:38px; border-radius:11px; background:#f7f7f5;
    border:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

  /* BADGES */
  .b-ok { display:inline-flex; padding:3px 9px; border-radius:100px;
    background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:10px; font-weight:600; white-space:nowrap; }
  .b-pe { display:inline-flex; padding:3px 9px; border-radius:100px;
    background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-size:10px; font-weight:600; white-space:nowrap; }
  .b-re { display:inline-flex; padding:3px 9px; border-radius:100px;
    background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-size:10px; font-weight:600; white-space:nowrap; }
  .b-df { display:inline-flex; padding:3px 9px; border-radius:100px;
    background:#f3f4f6; color:#6b7280; border:1px solid #e5e7eb; font-size:10px; font-weight:600; white-space:nowrap; }

  /* PROMO SCROLL */
  .promo-row { display:flex; gap:10px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
  .promo-row::-webkit-scrollbar { display:none; }
  .promo-card { min-width:180px; background:#fff; border-radius:16px; overflow:hidden; flex-shrink:0;
    box-shadow:0 2px 10px rgba(0,0,0,0.07); border:1px solid rgba(0,0,0,0.05); }
  .promo-img { width:100%; height:96px; object-fit:cover; }
  .promo-ph  { width:100%; height:96px; display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,#1a1208,#3d2a05); }

  /* EMPTY STATE */
  .empty { background:#fff; border-radius:18px; padding:32px 20px; text-align:center;
    box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.05); }
`

function Badge({ status }: { status: string }) {
  if (status === 'ADMIN_APPROVED') return <span className="b-ok">{statusLabel(status)}</span>
  if (status === 'PENDING')        return <span className="b-pe">{statusLabel(status)}</span>
  if (status === 'REJECTED')       return <span className="b-re">{statusLabel(status)}</span>
  return <span className="b-df">{statusLabel(status)}</span>
}

export default async function HomePage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const [{ data: user }, { data: purchases }, { data: promos }] = await Promise.all([
    supabase.from('users').select('*').eq('id', session.user.id).single(),
    supabase.from('purchase_registrations').select('*').eq('user_id', session.user.id)
      .order('created_at', { ascending: false }).limit(3),
    supabase.from('promotions').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(5),
  ])
  if (!user) redirect('/login')

  const tierCfg = {
    GOLD:     { next:'Platinum', max:2000 },
    SILVER:   { next:'Gold',     max:500  },
    PLATINUM: { next:null,       max:2000 },
  }
  const tc   = tierCfg[user.tier as keyof typeof tierCfg] || tierCfg.SILVER
  const pct  = tc.next ? Math.min(100, Math.round(user.lifetime_points / tc.max * 100)) : 100
  const need = tc.next ? Math.max(0, tc.max - user.lifetime_points) : 0
  const init = (user.full_name || 'D').split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()

  const actions = [
    { href:'/purchases/register', bg:'#fff8eb', color:'#d97706', Icon: Plus,    label:'ลงทะเบียน\nสินค้า' },
    { href:'/purchases',          bg:'#eff6ff', color:'#2563eb', Icon: Shield,  label:'การ\nประกัน'       },
    { href:'/coupons',            bg:'#f5f3ff', color:'#7c3aed', Icon: Tag,     label:'คูปอง\nของฉัน'     },
    { href:'/points',             bg:'#f0fdf4', color:'#059669', Icon: Star,    label:'แลก\nรางวัล'       },
  ]

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hw">

        {/* ── DARK HEADER ── */}
        <div className="hdr">
          <div className="hdr-glow" /><div className="hdr-line" /><div className="hdr-grid" />
          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ color:'rgba(255,255,255,0.38)', fontSize:10, margin:'0 0 4px', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                สมาชิก Dreame
              </p>
              <h1 style={{ color:'#fff', fontSize:22, fontWeight:800, margin:0, lineHeight:1.1 }}>
                {(user.full_name || 'สมาชิก').split(' ')[0]}
              </h1>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ width:40, height:40, borderRadius:13, background:'rgba(255,255,255,0.07)',
                border:'1px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center',
                justifyContent:'center', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>
                <Bell size={17}/>
              </div>
              <Link href="/profile">
                {user.profile_image_url
                  ? <img src={user.profile_image_url} alt="" style={{ width:40, height:40, borderRadius:13,
                      objectFit:'cover', border:'2px solid rgba(212,175,55,0.55)' }}/>
                  : <div style={{ width:40, height:40, borderRadius:13, display:'flex', alignItems:'center',
                      justifyContent:'center', fontWeight:800, fontSize:14, color:'#0d0d0d',
                      background:'linear-gradient(135deg,#d4af37,#f5d060)',
                      border:'2px solid rgba(212,175,55,0.55)' }}>{init}</div>}
              </Link>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="body">

          {/* Member Card */}
          <MemberCard user={user as User} />

          {/* Stat Strip */}
          <div className="stat-strip">
            <div className="stat-item">
              <p className="stat-num" style={{ color:'#d4af37' }}>{user.total_points.toLocaleString()}</p>
              <p className="stat-lbl">คะแนนคงเหลือ</p>
            </div>
            <div className="stat-item">
              <p className="stat-num" style={{ color:'#7c3aed' }}>{user.lifetime_points.toLocaleString()}</p>
              <p className="stat-lbl">สะสมตลอดกาล</p>
            </div>
            <div className="stat-item">
              <p className="stat-num" style={{ color:'#059669' }}>{(purchases||[]).length}</p>
              <p className="stat-lbl">สินค้าของฉัน</p>
            </div>
          </div>

          {/* Tier Progress */}
          {tc.next && (
            <div className="prog-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <TrendingUp size={14} color="#d4af37"/>
                  <span style={{ fontSize:12, fontWeight:600, color:'#374151' }}>
                    สู่ระดับ <span style={{ color:'#b8860b', fontWeight:800 }}>{tc.next}</span>
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'#9ca3af' }}>อีก {need.toLocaleString()} แต้ม</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'#d4af37' }}>{pct}%</span>
                </div>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{ width:`${pct}%` }}/>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <div className="sec-hdr">
              <span className="sec-title">เมนูด่วน</span>
            </div>
            <div className="act-grid">
              {actions.map(({ href, bg, color, Icon, label }) => (
                <Link key={href} href={href} className="act-item">
                  <div className="act-ico" style={{ background: bg }}>
                    <Icon size={19} color={color}/>
                  </div>
                  <span className="act-lbl">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Purchases */}
          {purchases && purchases.length > 0 ? (
            <div>
              <div className="sec-hdr">
                <span className="sec-title">สินค้าล่าสุด</span>
                <Link href="/purchases" className="sec-link">ดูทั้งหมด <ChevronRight size={13}/></Link>
              </div>
              <div className="plist">
                {(purchases as PurchaseRegistration[]).map(p => (
                  <div key={p.id} className="prow">
                    <div className="prow-ico"><Package size={17} color="#c4c4c4"/></div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:'#111', margin:'0 0 2px',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.model_name || p.order_sn}
                      </p>
                      <p style={{ fontSize:10, color:'#9ca3af', margin:0 }}>
                        {formatDate(p.purchase_date || p.created_at)}
                      </p>
                    </div>
                    <Badge status={p.status}/>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="sec-hdr"><span className="sec-title">สินค้าล่าสุด</span></div>
              <div className="empty">
                <Package size={32} color="#d1d5db" style={{ marginBottom:10 }}/>
                <p style={{ fontSize:13, color:'#6b7280', margin:'0 0 14px' }}>ยังไม่มีสินค้าที่ลงทะเบียน</p>
                <Link href="/purchases/register" style={{ display:'inline-flex', alignItems:'center', gap:6,
                  padding:'10px 20px', background:'#0d0d0d', color:'#d4af37', borderRadius:12,
                  fontSize:13, fontWeight:700, textDecoration:'none' }}>
                  <Plus size={14}/> ลงทะเบียนสินค้า
                </Link>
              </div>
            </div>
          )}

          {/* Promotions */}
          {promos && promos.length > 0 && (
            <div>
              <div className="sec-hdr"><span className="sec-title">โปรโมชั่น</span></div>
              <div className="promo-row">
                {(promos as Promotion[]).map(pr => (
                  <div key={pr.id} className="promo-card">
                    {pr.image_url
                      ? <img src={pr.image_url} alt={pr.title} className="promo-img"/>
                      : <div className="promo-ph"><Zap size={24} color="#d4af37"/></div>}
                    <div style={{ padding:'10px 12px' }}>
                      <p style={{ fontSize:12, fontWeight:700, color:'#111', margin:'0 0 2px',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pr.title}</p>
                      {pr.description && (
                        <p style={{ fontSize:10, color:'#9ca3af', margin:0,
                          overflow:'hidden', display:'-webkit-box',
                          WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>{pr.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}