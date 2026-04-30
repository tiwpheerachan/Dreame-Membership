// ============================================================
// Purchase detail — full information for one registered product:
// model name, full BQ items breakdown, order timeline, points
// calculation, warranty status, receipt preview.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Package, ShieldCheck, CalendarDays,
  ShoppingBag, Globe, Store, Sparkles, Hash, FileText, AlertCircle, Coins, ExternalLink,
} from 'lucide-react'
import type { PurchaseRegistration, BQOrderData, BQOrderItem } from '@/types'
import { formatDate, warrantyDaysLeft } from '@/lib/utils'
import { calculatePoints, normalizeTier } from '@/lib/points'
import { EARN_DIVISOR_BY_CHANNEL, TIER_MULTIPLIER } from '@/types'

const CHANNEL: Record<string, { Icon: typeof ShoppingBag; label: string }> = {
  SHOPEE:  { Icon: ShoppingBag, label: 'Shopee'   },
  LAZADA:  { Icon: ShoppingBag, label: 'Lazada'   },
  WEBSITE: { Icon: Globe,       label: 'Website'  },
  TIKTOK:  { Icon: Sparkles,    label: 'TikTok'   },
  STORE:   { Icon: Store,       label: 'หน้าร้าน' },
  OTHER:   { Icon: Package,     label: 'อื่นๆ'    },
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ADMIN_APPROVED' || status === 'BQ_VERIFIED')
    return <span className="pill pill-green">Verified</span>
  if (status === 'PENDING')
    return <span className="pill pill-amber">Pending</span>
  if (status === 'REJECTED')
    return <span className="pill pill-red">Rejected</span>
  return <span className="pill">{status}</span>
}

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Pull the purchase + the user's tier (needed for points calculation)
  const [{ data: reg }, { data: profile }] = await Promise.all([
    supabase.from('purchase_registrations').select('*')
      .eq('id', params.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('users').select('tier').eq('id', user.id).maybeSingle(),
  ])
  if (!reg) notFound()

  const p = reg as PurchaseRegistration
  const bq = (p.bq_raw_data as BQOrderData | null) ?? null
  const items: BQOrderItem[] = Array.isArray(bq?.items) ? bq!.items : []
  const ch = CHANNEL[p.channel] || CHANNEL.OTHER
  const daysLeft = warrantyDaysLeft(p.warranty_end)
  const wOk = daysLeft > 0

  // Points: prefer the awarded number; if zero, show the projected amount so
  // the user understands what they'll earn once verification completes.
  const userTier = normalizeTier((profile?.tier as string) || 'SILVER')
  const projected = calculatePoints(p.total_amount || 0, userTier, p.channel)
  const showProjected = (p.points_awarded || 0) === 0 && projected > 0
  const divisor = EARN_DIVISOR_BY_CHANNEL[(p.channel as keyof typeof EARN_DIVISOR_BY_CHANNEL)] ?? 500
  const multiplier = TIER_MULTIPLIER[userTier] ?? 1.0

  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0)

  return (
    <div className="page-enter" style={{ paddingTop: 18, paddingBottom: 32 }}>
      {/* Header */}
      <header style={{ padding: '14px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/purchases" className="tap-down" style={{
          width: 38, height: 38, borderRadius: '50%',
          background: '#fff', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink)', textDecoration: 'none',
        }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Purchase Detail</p>
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.1 }}>
            <span style={{ fontWeight: 800 }}>รายละเอียด</span>{' '}
            <span className="serif-i" style={{ fontWeight: 400 }}>สินค้า</span>
          </h1>
        </div>
      </header>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── Hero: model name + status ── */}
        <div className="surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <p className="kicker" style={{ margin: 0 }}>Product</p>
            <StatusBadge status={p.status} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 700, lineHeight: 1.35 }}>
            {p.model_name || p.item_name || p.order_sn}
          </h2>
          {p.sku && (
            <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '0 0 12px',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
              SKU: {p.sku}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span className="pill"><ch.Icon size={11} />{ch.label}</span>
            {p.purchase_date && (
              <span className="pill"><CalendarDays size={11} />{formatDate(p.purchase_date)}</span>
            )}
            {(p.total_amount || 0) > 0 && (
              <span className="pill">฿{Number(p.total_amount).toLocaleString()}</span>
            )}
            {totalQty > 0 && (
              <span className="pill">{totalQty} ชิ้น</span>
            )}
          </div>
        </div>

        {/* ── Points earned / projected ── */}
        {(p.points_awarded > 0 || showProjected) && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--gold-glow)',
                border: '1px solid var(--gold-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Coins size={14} color="var(--gold-deep)" strokeWidth={2.2} />
              </div>
              <p className="kicker" style={{ margin: 0 }}>คะแนนที่ได้รับ</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span className="display tnum" style={{
                fontSize: 32, lineHeight: 1, fontWeight: 800,
                background: 'linear-gradient(135deg, var(--gold-deep), var(--gold), var(--gold-soft))',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                +{(p.points_awarded || projected).toLocaleString()}
              </span>
              <span style={{ fontSize: 12, color: 'var(--gold-deep)', fontWeight: 700 }}>pts</span>
              {showProjected && (
                <span className="pill pill-amber" style={{ marginLeft: 6 }}>คาดการณ์</span>
              )}
            </div>
            {/* Calculation breakdown */}
            <div style={{
              fontSize: 11.5, color: 'var(--ink-mute)',
              padding: '8px 10px', background: 'var(--bg-soft)',
              borderRadius: 'var(--r-sm)', lineHeight: 1.65,
            }}>
              ฿{Number(p.total_amount || 0).toLocaleString()} ÷ {divisor} = {Math.floor((p.total_amount || 0) / divisor)} pts
              {multiplier > 1 && (
                <>
                  {' × '}{multiplier}× ({userTier} VIP)
                  {' = '}{Math.floor(Math.floor((p.total_amount || 0) / divisor) * multiplier)} pts
                </>
              )}
            </div>
            {p.points_awarded_at && (
              <p style={{ fontSize: 10.5, color: 'var(--ink-faint)', margin: '8px 0 0' }}>
                ได้รับเมื่อ {formatDate(p.points_awarded_at)}
              </p>
            )}
          </div>
        )}

        {/* ── Order info ── */}
        <div className="surface" style={{ padding: 18 }}>
          <p className="kicker" style={{ margin: '0 0 12px' }}>Order Information</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Order ID" value={p.order_sn} mono />
            {p.invoice_no && <Row label="Invoice" value={p.invoice_no} mono />}
            <Row label="ช่องทาง" value={ch.label} />
            {p.platform && <Row label="Platform" value={p.platform} />}
            {p.purchase_date && <Row label="วันที่ซื้อ" value={formatDate(p.purchase_date)} />}
            {bq?.order_create_time && (
              <Row label="เวลาสร้างออเดอร์" value={String(bq.order_create_time)} mono />
            )}
            <Row label="ยอดรวม" value={`฿${Number(p.total_amount || 0).toLocaleString()}`} bold />
            {p.serial_number && <Row label="Serial" value={p.serial_number} mono />}
            <Row label="ลงทะเบียนเมื่อ" value={formatDate(p.created_at)} />
          </div>
        </div>

        {/* ── BQ items (if available) ── */}
        {items.length > 0 && (
          <div className="surface" style={{ padding: 18 }}>
            <p className="kicker" style={{ margin: '0 0 12px' }}>รายการสินค้า ({items.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((it, i) => {
                const qty = Number(it.quantity || 0)
                const price = Number(it.price || 0)
                return (
                  <div key={i} style={{
                    padding: 12,
                    background: 'var(--bg-soft)',
                    borderRadius: 'var(--r-sm)',
                  }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                      {it.item_name || it.model_name || '—'}
                    </p>
                    {it.model_name && it.item_name && it.model_name !== it.item_name && (
                      <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--ink-mute)' }}>
                        รุ่น: {it.model_name}
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{it.item_sku || it.model_sku || ''}</span>
                      <span>
                        ฿{price.toLocaleString()} × {qty} ={' '}
                        <strong style={{ color: 'var(--ink)' }}>฿{(price * qty).toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Warranty ── */}
        {p.warranty_end && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <ShieldCheck size={18} color={wOk ? 'var(--green)' : 'var(--ink-faint)'} strokeWidth={1.7} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: 0,
                  color: wOk ? 'var(--green)' : 'var(--ink-faint)' }}>
                  {wOk ? 'ประกันยังมีผล' : 'ประกันหมดอายุ'}
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0' }}>
                  {p.warranty_start ? `${formatDate(p.warranty_start)} → ` : ''}{formatDate(p.warranty_end)}
                </p>
              </div>
              {wOk && <span className="pill pill-green">{daysLeft} วัน</span>}
            </div>
          </div>
        )}

        {/* ── Pending notice ── */}
        {p.status === 'PENDING' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 14,
            background: 'var(--amber-soft)',
            border: '1px solid rgba(154,110,31,0.20)',
            borderRadius: 'var(--r-md)',
          }}>
            <AlertCircle size={16} color="var(--amber)" />
            <p style={{ fontSize: 12, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
              กำลังตรวจสอบ · ใช้เวลาสูงสุด 6 ชั่วโมง<br/>
              <span style={{ fontSize: 11, opacity: 0.8 }}>
                คะแนนจะถูกเพิ่มอัตโนมัติเมื่อระบบยืนยันออเดอร์เสร็จ
              </span>
            </p>
          </div>
        )}

        {/* ── Receipt ── */}
        {p.receipt_image_url && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FileText size={14} color="var(--ink-mute)" />
              <p className="kicker" style={{ margin: 0 }}>ใบเสร็จ</p>
              <a href={p.receipt_image_url} target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gold-deep)',
                  display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                เปิดดูเต็ม <ExternalLink size={11} />
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.receipt_image_url} alt="receipt"
              style={{
                width: '100%', maxHeight: 400, objectFit: 'contain',
                borderRadius: 'var(--r-sm)', background: 'var(--bg-soft)',
              }} />
          </div>
        )}

        {/* ── Admin note (if any) ── */}
        {p.admin_note && (
          <div className="surface" style={{ padding: 14 }}>
            <p className="kicker" style={{ margin: '0 0 6px' }}>หมายเหตุจาก Admin</p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.55 }}>
              {p.admin_note}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink-mute)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 12.5, color: 'var(--ink)',
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        textAlign: 'right', wordBreak: 'break-all',
      }}>{value}</span>
    </div>
  )
}
