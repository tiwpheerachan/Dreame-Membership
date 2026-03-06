import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Star, TrendingUp, TrendingDown, RefreshCw, Settings } from 'lucide-react'
import type { User, PointsLog } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { getNextTierInfo } from '@/lib/points'

const CSS = `
  .ptw { padding:0 0 16px; }
  .pt-hdr { background:#0d0d0d; padding:48px 20px 28px; position:relative; overflow:hidden; }
  .pt-hdr::before { content:''; position:absolute; top:-60px; right:-60px; width:200px; height:200px; border-radius:50%; background:radial-gradient(circle,rgba(212,175,55,0.15) 0%,transparent 70%); }
  .pt-hdr-line { position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(212,175,55,0.4),transparent); }
  .pt-body { padding:16px; display:flex; flex-direction:column; gap:12px; }

  .pt-summary { background:#fff; border-radius:18px; padding:20px; box-shadow:0 1px 6px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.04); }
  .pt-big { font-size:38px; font-weight:800; color:#0d0d0d; margin:0; line-height:1; }
  .pt-big span { font-size:16px; color:#d4af37; font-weight:600; margin-left:6px; }

  .tier-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:14px; padding-top:14px; border-top:1px solid #f7f7f5; }
  .tier-box { border-radius:12px; padding:10px 6px; text-align:center; border:1px solid transparent; }
  .tier-box-active { background:#0d0d0d; border-color:#d4af37; }
  .tier-box-inactive { background:#f7f7f5; }

  .prog-wrap { margin-top:14px; padding-top:14px; border-top:1px solid #f7f7f5; }
  .prog-bar { height:6px; background:#f3f4f6; border-radius:100px; overflow:hidden; margin-top:8px; }
  .prog-fill { height:100%; border-radius:100px; background:linear-gradient(90deg,#b8860b,#d4af37,#f5d060); }

  .log-card { background:#fff; border-radius:18px; overflow:hidden; box-shadow:0 1px 6px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.04); }
  .log-hdr { padding:14px 16px; border-bottom:1px solid #f7f7f5; }
  .log-row { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid #fafafa; }
  .log-row:last-child { border-bottom:none; }
  .log-ico { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
`

const typeCfg = {
  EARNED:       { label:'ได้รับแต้ม',      Icon: TrendingUp,   bg:'#f0fdf4', color:'#16a34a', val:(n:number)=>`+${n.toLocaleString()}` },
  REDEEMED:     { label:'แลกแต้ม',         Icon: TrendingDown,  bg:'#fef2f2', color:'#dc2626', val:(n:number)=>`-${Math.abs(n).toLocaleString()}` },
  EXPIRED:      { label:'หมดอายุ',         Icon: RefreshCw,     bg:'#f9fafb', color:'#9ca3af', val:(n:number)=>`-${Math.abs(n).toLocaleString()}` },
  ADMIN_ADJUST: { label:'ปรับโดย Admin',   Icon: Settings,      bg:'#fffbeb', color:'#d97706', val:(n:number)=> n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString() },
}

export default async function PointsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const [{ data: user }, { data: logs }] = await Promise.all([
    supabase.from('users').select('*').eq('id', session.user.id).single(),
    supabase.from('points_log').select('*').eq('user_id', session.user.id)
      .order('created_at', { ascending: false }).limit(50),
  ])
  if (!user) redirect('/login')

  const tierInfo = getNextTierInfo(user.tier, user.lifetime_points)
  const tiers = [
    { key:'SILVER', label:'Silver', mult:'1×' },
    { key:'GOLD',   label:'Gold',   mult:'1.5×' },
    { key:'PLATINUM', label:'Platinum', mult:'2×' },
  ]

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ptw">
        {/* Header */}
        <div className="pt-hdr">
          <div className="pt-hdr-line" />
          <div style={{ position:'relative', zIndex:1 }}>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, margin:'0 0 3px', letterSpacing:'0.06em', textTransform:'uppercase' }}>Dreame Rewards</p>
            <h1 style={{ color:'#fff', fontSize:20, fontWeight:700, margin:0 }}>คะแนนสะสม</h1>
          </div>
        </div>

        <div className="pt-body">
          {/* Summary card */}
          <div className="pt-summary">
            <p style={{ fontSize:11, color:'#9ca3af', fontWeight:500, margin:'0 0 6px', textTransform:'uppercase', letterSpacing:'0.06em' }}>คะแนนคงเหลือ</p>
            <p className="pt-big">{user.total_points.toLocaleString()}<span>แต้ม</span></p>

            <div style={{ display:'flex', gap:16, marginTop:12, paddingTop:12, borderTop:'1px solid #f7f7f5' }}>
              <div>
                <p style={{ fontSize:10, color:'#9ca3af', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.05em' }}>สะสมตลอดกาล</p>
                <p style={{ fontSize:16, fontWeight:700, color:'#7c3aed', margin:0 }}>{user.lifetime_points.toLocaleString()}</p>
              </div>
              <div style={{ width:1, background:'#f3f4f6' }}/>
              <div>
                <p style={{ fontSize:10, color:'#9ca3af', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.05em' }}>ระดับสมาชิก</p>
                <p style={{ fontSize:16, fontWeight:700, color:'#d4af37', margin:0 }}>{user.tier}</p>
              </div>
            </div>

            {/* Tier boxes */}
            <div className="tier-grid">
              {tiers.map(t => (
                <div key={t.key} className={`tier-box ${user.tier === t.key ? 'tier-box-active' : 'tier-box-inactive'}`}>
                  <p style={{ fontSize:10, fontWeight:700, margin:'0 0 2px', color: user.tier === t.key ? '#d4af37' : '#9ca3af', letterSpacing:'0.04em' }}>{t.label}</p>
                  <p style={{ fontSize:17, fontWeight:800, margin:0, color: user.tier === t.key ? '#fff' : '#d1d5db' }}>{t.mult}</p>
                  <p style={{ fontSize:9, color: user.tier === t.key ? 'rgba(255,255,255,0.5)' : '#d1d5db', margin:0 }}>แต้ม</p>
                </div>
              ))}
            </div>

            {/* Progress */}
            {tierInfo.nextTier && (
              <div className="prog-wrap">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <p style={{ fontSize:12, fontWeight:600, color:'#374151', margin:0 }}>
                    สู่ระดับ <span style={{ color:'#d4af37' }}>{tierInfo.nextTier}</span>
                  </p>
                  <p style={{ fontSize:11, color:'#d4af37', fontWeight:700, margin:0 }}>
                    อีก {tierInfo.pointsNeeded?.toLocaleString()} แต้ม
                  </p>
                </div>
                <div className="prog-bar">
                  <div className="prog-fill" style={{ width:`${tierInfo.progress}%` }}/>
                </div>
              </div>
            )}
            {user.tier === 'PLATINUM' && (
              <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #f7f7f5', textAlign:'center' }}>
                <p style={{ fontSize:13, color:'#0891b2', fontWeight:600, margin:0 }}>◆ คุณอยู่ในระดับสูงสุด Platinum แล้ว!</p>
              </div>
            )}
          </div>

          {/* Log */}
          <div className="log-card">
            <div className="log-hdr">
              <p style={{ fontSize:14, fontWeight:700, color:'#111', margin:0 }}>ประวัติแต้ม</p>
            </div>
            {!logs || logs.length === 0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>ยังไม่มีประวัติ</div>
            ) : (logs as PointsLog[]).map(log => {
              const cfg = typeCfg[log.type] || typeCfg.EARNED
              const Icon = cfg.Icon
              return (
                <div key={log.id} className="log-row">
                  <div className="log-ico" style={{ background: cfg.bg }}>
                    <Icon size={15} color={cfg.color}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:500, color:'#111827', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {log.description || cfg.label}
                    </p>
                    <p style={{ fontSize:10, color:'#9ca3af', margin:0 }}>{formatDateTime(log.created_at)}</p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:14, fontWeight:700, margin:'0 0 2px', color: cfg.color }}>
                      {cfg.val(log.points_delta)}
                    </p>
                    <p style={{ fontSize:10, color:'#9ca3af', margin:0 }}>{log.balance_after.toLocaleString()} แต้ม</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}