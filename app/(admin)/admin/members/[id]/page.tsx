import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Shield, Package, ExternalLink, Phone, Mail, MapPin, Calendar,
  Star, TrendingUp, Award, Clock, CheckCircle, XCircle, AlertCircle,
  ShoppingBag, CreditCard, FileText, BarChart3, History
} from 'lucide-react'
import { formatDate, formatDateTime, channelLabel, warrantyDaysLeft } from '@/lib/utils'
import AdjustPointsForm from '@/components/admin/AdjustPointsForm'
import ApprovePurchaseButtons from '@/components/admin/ApprovePurchaseButtons'
import AddPurchaseForm from '@/components/admin/AddPurchaseForm'
import DeletePurchaseButton from '@/components/admin/DeletePurchaseButton'

type Purchase = {
  id: string; order_sn: string; model_name: string | null; channel: string
  total_amount: number; serial_number: string | null; sku: string | null
  purchase_date: string | null; points_awarded: number; warranty_end: string | null
  receipt_image_url: string | null; admin_note: string | null; status: string
  approved_by: string | null; approved_at: string | null; user_id: string; created_at: string
}
type PointsLog = {
  id: string; description: string | null; created_at: string
  points_delta: number; balance_after: number; adjusted_by: string | null
}
type StaffMember = { id: string; name: string; role: string }

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    ADMIN_APPROVED: { label: 'ยืนยันแล้ว', cls: 'badge-approved', icon: <CheckCircle size={12} /> },
    PENDING:        { label: 'รอตรวจสอบ',  cls: 'badge-pending',  icon: <AlertCircle size={12} /> },
    REJECTED:       { label: 'ปฏิเสธ',     cls: 'badge-rejected', icon: <XCircle size={12} /> },
  }
  const c = cfg[status] || cfg.PENDING
  return (
    <span className={`status-badge ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null
  return (
    <div className="info-row">
      <div className="info-icon">{icon}</div>
      <div>
        <p className="info-label">{label}</p>
        <p className="info-value">{value}</p>
      </div>
    </div>
  )
}

const PAGE_CSS = `
  .member-page { background:#f8fafc; min-height:100vh; font-family:'Prompt',system-ui,sans-serif; }
  .topbar { background:#fff; border-bottom:1px solid #e5e7eb; padding:0 32px; position:sticky; top:0; z-index:30; }
  .topbar-inner { max-width:1400px; margin:0 auto; height:60px; display:flex; align-items:center; gap:16px; }
  .back-btn { width:36px; height:36px; border-radius:10px; background:#f3f4f6; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; color:#6b7280; text-decoration:none; flex-shrink:0; transition:background 0.15s; }
  .back-btn:hover { background:#e5e7eb; }
  .stat-chip { padding:6px 14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; text-align:center; }
  .stat-chip-val { font-size:15px; font-weight:700; margin:0; line-height:1; }
  .stat-chip-lbl { font-size:10px; color:#9ca3af; margin:3px 0 0; white-space:nowrap; }
  .main-grid { max-width:1400px; margin:0 auto; padding:28px 32px; display:grid; grid-template-columns:340px 1fr; gap:24px; align-items:start; }
  .card { background:#fff; border:1px solid #e5e7eb; border-radius:20px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
  .card-header { padding:16px 20px; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; gap:10px; }
  .card-icon { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
  .card-title { font-size:14px; font-weight:700; color:#111827; margin:0; }
  .info-row { display:flex; align-items:flex-start; gap:12px; padding:12px 0; border-bottom:1px solid #f3f4f6; }
  .info-icon { width:34px; height:34px; border-radius:10px; background:#f9fafb; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; color:#6b7280; flex-shrink:0; }
  .info-label { font-size:11px; color:#9ca3af; font-weight:500; margin:0 0 2px; text-transform:uppercase; letter-spacing:0.05em; }
  .info-value { font-size:14px; color:#111827; font-weight:500; margin:0; word-break:break-all; }
  .status-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px; font-size:11px; font-weight:600; white-space:nowrap; }
  .badge-approved { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
  .badge-pending  { background:#fefce8; color:#ca8a04; border:1px solid #fde68a; }
  .badge-rejected { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
  .tier-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:100px; font-size:12px; font-weight:700; flex-shrink:0; }
  .tier-gold     { background:#fef3c7; color:#92400e; border:1px solid #fde68a; }
  .tier-platinum { background:#cffafe; color:#0e7490; border:1px solid #a5f3fc; }
  .tier-silver   { background:#f3f4f6; color:#374151; border:1px solid #e5e7eb; }
  .purchase-row { padding:20px 24px; border-bottom:1px solid #f3f4f6; }
  .purchase-row:hover { background:#fafafa; }
  .purchase-row:last-child { border-bottom:none; }
  .chip { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px; background:#f9fafb; border:1px solid #e5e7eb; font-size:11px; color:#6b7280; font-weight:500; }
  .chip-amount { color:#374151; }
  .chip-points { color:#d97706; font-weight:600; }
  .warranty-ok  { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:100px; font-size:11px; font-weight:600; background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
  .warranty-exp { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:100px; font-size:11px; font-weight:600; background:#f9fafb; color:#9ca3af; border:1px solid #e5e7eb; }
  .receipt-link { display:inline-flex; align-items:center; gap:4px; padding:5px 12px; border-radius:100px; background:#eff6ff; border:1px solid #bfdbfe; color:#2563eb; font-size:11px; font-weight:600; text-decoration:none; }
  .receipt-link:hover { background:#dbeafe; }
  .log-row { display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid #f9fafb; }
  .log-icon-pos { width:34px; height:34px; border-radius:10px; background:#f0fdf4; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .log-icon-neg { width:34px; height:34px; border-radius:10px; background:#fef2f2; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .left-col { display:flex; flex-direction:column; gap:16px; }
`

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const [{ data: user }, { data: purchases }, { data: pointsLog }, { data: staffList }] = await Promise.all([
    supabase.from('users').select('*').eq('id', params.id).single(),
    supabase.from('purchase_registrations').select('*').eq('user_id', params.id).order('created_at', { ascending: false }),
    supabase.from('points_log').select('*').eq('user_id', params.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('admin_staff').select('id, name, role'),
  ])

  if (!user) notFound()

  const staffMap: Record<string, string> = Object.fromEntries(
    ((staffList || []) as StaffMember[]).map(s => [s.id, s.name])
  )

  const tierCfg = {
    PLATINUM: { bg: 'linear-gradient(135deg,#0891b2,#06b6d4,#67e8f9)', badgeCls: 'tier-platinum', label: 'Platinum', icon: <Award size={13}/> },
    GOLD:     { bg: 'linear-gradient(135deg,#d97706,#f59e0b,#fbbf24)', badgeCls: 'tier-gold',     label: 'Gold',     icon: <Star size={13}/> },
    SILVER:   { bg: 'linear-gradient(135deg,#6b7280,#9ca3af,#d1d5db)', badgeCls: 'tier-silver',   label: 'Silver',   icon: <Shield size={13}/> },
  }
  const tier = tierCfg[user.tier as keyof typeof tierCfg] || tierCfg.SILVER
  const initials = (user.full_name||'?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const purchaseList = (purchases || []) as Purchase[]
  const pointsList = (pointsLog || []) as PointsLog[]
  const approved = purchaseList.filter(p => p.status === 'ADMIN_APPROVED').length
  const pending  = purchaseList.filter(p => p.status === 'PENDING').length

  const tierProgress = user.tier === 'SILVER' ? { label: 'Gold', max: 500 }
    : user.tier === 'GOLD' ? { label: 'Platinum', max: 2000 } : null

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      <div className="member-page">
        {/* Top Bar */}
        <div className="topbar">
          <div className="topbar-inner">
            <Link href="/admin/members" className="back-btn">
              <ArrowLeft size={16} />
            </Link>
            <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
              <div style={{ width:38, height:38, borderRadius:12, background:tier.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
                {initials}
              </div>
              <div style={{ minWidth:0 }}>
                <h1 style={{ fontSize:17, fontWeight:700, color:'#111827', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.full_name || 'สมาชิก'}</h1>
                <p style={{ fontSize:12, color:'#9ca3af', margin:0, fontFamily:'monospace' }}>{user.member_id}</p>
              </div>
              <span className={`tier-badge ${tier.badgeCls}`}>{tier.icon} {tier.label}</span>
            </div>
            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
              {[
                { label:'ทั้งหมด', val:purchaseList.length, color:'#6366f1' },
                { label:'ยืนยันแล้ว', val:approved,         color:'#16a34a' },
                { label:'รอตรวจสอบ', val:pending,           color:'#ca8a04' },
              ].map(s => (
                <div key={s.label} className="stat-chip">
                  <p className="stat-chip-val" style={{ color:s.color }}>{s.val}</p>
                  <p className="stat-chip-lbl">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="main-grid">

          {/* ── LEFT ── */}
          <div className="left-col">

            {/* Member Info */}
            <div className="card" style={{ padding:'24px' }}>
              <div style={{ textAlign:'center', marginBottom:20, paddingBottom:20, borderBottom:'1px solid #f3f4f6' }}>
                <div style={{ width:72, height:72, borderRadius:20, background:tier.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff', margin:'0 auto 12px', boxShadow:'0 8px 24px rgba(0,0,0,0.15)' }}>
                  {initials}
                </div>
                <h2 style={{ fontSize:18, fontWeight:700, color:'#111827', margin:'0 0 3px' }}>{user.full_name || 'สมาชิก'}</h2>
                <p style={{ fontSize:12, color:'#9ca3af', fontFamily:'monospace', margin:0 }}>{user.member_id}</p>
              </div>
              <InfoRow icon={<Phone size={15}/>}    label="เบอร์โทร"      value={user.phone||''} />
              <InfoRow icon={<Mail size={15}/>}     label="อีเมล"         value={user.email||''} />
              <InfoRow icon={<MapPin size={15}/>}   label="ที่อยู่"       value={user.address||''} />
              <InfoRow icon={<Calendar size={15}/>} label="สมาชิกตั้งแต่" value={formatDate(user.created_at)} />
            </div>

            {/* Points */}
            <div className="card">
              <div className="card-header">
                <div className="card-icon" style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)' }}><BarChart3 size={16}/></div>
                <h3 className="card-title">คะแนนสะสม</h3>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                <div style={{ padding:'20px', borderRight:'1px solid #f3f4f6', textAlign:'center' }}>
                  <p style={{ fontSize:28, fontWeight:800, color:'#f59e0b', margin:'0 0 3px', lineHeight:1 }}>{user.total_points.toLocaleString()}</p>
                  <p style={{ fontSize:11, color:'#9ca3af', margin:0, fontWeight:500 }}>คะแนนคงเหลือ</p>
                </div>
                <div style={{ padding:'20px', textAlign:'center' }}>
                  <p style={{ fontSize:28, fontWeight:800, color:'#6366f1', margin:'0 0 3px', lineHeight:1 }}>{user.lifetime_points.toLocaleString()}</p>
                  <p style={{ fontSize:11, color:'#9ca3af', margin:0, fontWeight:500 }}>สะสมตลอดกาล</p>
                </div>
              </div>

              {tierProgress && (
                <div style={{ padding:'16px 20px', borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:11, color:'#9ca3af', display:'flex', alignItems:'center', gap:4 }}>
                      <TrendingUp size={12}/> สู่ระดับ {tierProgress.label}
                    </span>
                    <span style={{ fontSize:11, fontWeight:600, color:'#f59e0b' }}>
                      {Math.min(user.lifetime_points, tierProgress.max).toLocaleString()} / {tierProgress.max.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height:6, background:'#e5e7eb', borderRadius:100, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100,(user.lifetime_points/tierProgress.max)*100)}%`, background:'linear-gradient(90deg,#f59e0b,#d97706)', borderRadius:100 }} />
                  </div>
                  {user.lifetime_points < tierProgress.max && (
                    <p style={{ fontSize:10, color:'#9ca3af', margin:'5px 0 0' }}>
                      อีก {(tierProgress.max - user.lifetime_points).toLocaleString()} คะแนน
                    </p>
                  )}
                </div>
              )}

              <div style={{ padding:'16px 20px', borderTop:'1px solid #f3f4f6' }}>
                <p style={{ fontSize:11, color:'#9ca3af', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 10px', display:'flex', alignItems:'center', gap:6 }}>
                  <CreditCard size={12}/> ปรับแต้ม (Admin)
                </p>
                <AdjustPointsForm userId={user.id} currentPoints={user.total_points} />
              </div>
            </div>

            {/* Points Log */}
            <div className="card">
              <div className="card-header">
                <div className="card-icon" style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)' }}><History size={16}/></div>
                <h3 className="card-title">ประวัติแต้ม</h3>
              </div>
              <div style={{ maxHeight:320, overflowY:'auto' }}>
                {pointsList.length === 0 ? (
                  <div style={{ padding:'32px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>ยังไม่มีประวัติแต้ม</div>
                ) : pointsList.map(log => (
                  <div key={log.id} className="log-row">
                    <div className={log.points_delta > 0 ? 'log-icon-pos' : 'log-icon-neg'}>
                      <TrendingUp size={14} color={log.points_delta > 0 ? '#16a34a' : '#dc2626'}
                        style={{ transform: log.points_delta < 0 ? 'rotate(180deg)' : 'none' }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, color:'#374151', margin:'0 0 2px', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {log.description || '-'}
                      </p>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <p style={{ fontSize:11, color:'#9ca3af', margin:0 }}>
                          <Clock size={10} style={{ display:'inline', marginRight:3 }}/>{formatDateTime(log.created_at)}
                        </p>
                        {log.adjusted_by && staffMap[log.adjusted_by] && (
                          <span style={{ fontSize:11, color:'#f59e0b', fontWeight:600 }}>· {staffMap[log.adjusted_by]}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ fontSize:14, fontWeight:700, margin:'0 0 2px', color: log.points_delta > 0 ? '#16a34a' : '#dc2626' }}>
                        {log.points_delta > 0 ? '+' : ''}{log.points_delta.toLocaleString()}
                      </p>
                      <p style={{ fontSize:10, color:'#9ca3af', margin:0 }}>คงเหลือ {log.balance_after.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div>
            <div className="card">
              <div style={{ padding:'18px 24px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#0ea5e9,#0284c7)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                    <ShoppingBag size={18}/>
                  </div>
                  <div>
                    <h2 style={{ fontSize:16, fontWeight:700, color:'#111827', margin:0 }}>ประวัติสินค้า</h2>
                    <p style={{ fontSize:12, color:'#9ca3af', margin:0 }}>{purchaseList.length} รายการ</p>
                  </div>
                </div>
                <AddPurchaseForm userId={user.id} userName={user.full_name || 'สมาชิก'} />
              </div>

              {purchaseList.length === 0 ? (
                <div style={{ padding:'64px 24px', textAlign:'center' }}>
                  <div style={{ width:64, height:64, borderRadius:20, background:'#f9fafb', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                    <Package size={28} color='#d1d5db'/>
                  </div>
                  <p style={{ color:'#6b7280', fontSize:14, fontWeight:500, margin:'0 0 4px' }}>ยังไม่มีประวัติการซื้อ</p>
                  <p style={{ color:'#9ca3af', fontSize:12, margin:0 }}>กดปุ่ม &quot;เพิ่มประวัติการซื้อ&quot; เพื่อเพิ่มรายการ</p>
                </div>
              ) : purchaseList.map(p => {
                const daysLeft = warrantyDaysLeft(p.warranty_end ?? '')
                const warrantyOk = daysLeft > 0
                return (
                  <div key={p.id} className="purchase-row">
                    {/* Name + Status */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12, minWidth:0, flex:1 }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:'#f0f9ff', border:'1px solid #bae6fd', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Package size={18} color='#0284c7'/>
                        </div>
                        <div style={{ minWidth:0 }}>
                          <p style={{ fontSize:15, fontWeight:700, color:'#111827', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {p.model_name || `Order: ${p.order_sn}`}
                          </p>
                          <p style={{ fontSize:11, color:'#9ca3af', margin:0, fontFamily:'monospace' }}>{p.order_sn}</p>
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        <StatusBadge status={p.status}/>
                        <DeletePurchaseButton purchaseId={p.id} orderSn={p.order_sn} modelName={p.model_name ?? undefined} pointsAwarded={p.points_awarded}/>
                      </div>
                    </div>

                    {/* Detail chips */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10, paddingLeft:52 }}>
                      <span className="chip"><ShoppingBag size={11}/> {channelLabel(p.channel)}</span>
                      {p.total_amount > 0 && <span className="chip chip-amount"><CreditCard size={11}/> ฿{p.total_amount.toLocaleString()}</span>}
                      {p.serial_number && <span className="chip"><FileText size={11}/> S/N: {p.serial_number}</span>}
                      {p.purchase_date && <span className="chip"><Calendar size={11}/> {formatDate(p.purchase_date)}</span>}
                      {p.points_awarded > 0 && <span className="chip chip-points"><Star size={11}/> +{p.points_awarded} แต้ม</span>}
                    </div>

                    {/* Warranty + Receipt */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', paddingLeft:52 }}>
                      {p.warranty_end && (
                        <span className={warrantyOk ? 'warranty-ok' : 'warranty-exp'}>
                          <Shield size={11}/>
                          {warrantyOk ? `ประกันคงเหลือ ${daysLeft} วัน (ถึง ${formatDate(p.warranty_end)})` : `ประกันหมด ${formatDate(p.warranty_end)}`}
                        </span>
                      )}
                      {p.receipt_image_url && (
                        <a href={p.receipt_image_url} target="_blank" rel="noopener noreferrer" className="receipt-link">
                          <ExternalLink size={11}/> ดูใบเสร็จ
                        </a>
                      )}
                    </div>

                    {p.admin_note && (
                      <p style={{ fontSize:11, color:'#9ca3af', margin:'8px 0 0', fontStyle:'italic', paddingLeft:52 }}>
                        <FileText size={10} style={{ display:'inline', marginRight:4 }}/> {p.admin_note}
                      </p>
                    )}

                    {p.approved_by && (p.status === 'ADMIN_APPROVED' || p.status === 'REJECTED') && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, paddingLeft:52 }}>
                        {p.status === 'REJECTED' ? <XCircle size={12} color='#dc2626'/> : <CheckCircle size={12} color='#16a34a'/>}
                        <span style={{ fontSize:11, color:'#9ca3af' }}>{p.status === 'REJECTED' ? 'ปฏิเสธโดย' : 'อนุมัติโดย'}:</span>
                        <span style={{ fontSize:11, fontWeight:700, color:'#f59e0b' }}>{staffMap[p.approved_by] || 'Admin'}</span>
                        {p.approved_at && <span style={{ fontSize:11, color:'#d1d5db' }}>· {formatDateTime(p.approved_at)}</span>}
                      </div>
                    )}

                    {p.status === 'PENDING' && (
                      <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #f3f4f6', paddingLeft:52 }}>
                        <ApprovePurchaseButtons purchaseId={p.id}/>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}