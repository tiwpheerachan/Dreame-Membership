import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Package, Plus, ShieldCheck, CalendarDays,
  ShoppingBag, Globe, Store, Sparkles, AlertCircle, ChevronRight,
  CheckCircle, XCircle, Clock,
} from 'lucide-react'
import type { PurchaseRegistration } from '@/types'
import { formatDate, warrantyDaysLeft } from '@/lib/utils'
import { calculatePoints, normalizeTier } from '@/lib/points'

const CHANNEL: Record<string, { Icon: typeof ShoppingBag; label: string }> = {
  SHOPEE:  { Icon: ShoppingBag, label: 'Shopee'   },
  LAZADA:  { Icon: ShoppingBag, label: 'Lazada'   },
  WEBSITE: { Icon: Globe,       label: 'Website'  },
  TIKTOK:  { Icon: Sparkles,    label: 'TikTok'   },
  STORE:   { Icon: Store,       label: 'หน้าร้าน' },
  OTHER:   { Icon: Package,     label: 'อื่นๆ'    },
}

// Status tone — soft pastel pill that conveys state at a glance.
const STATUS_TONE: Record<string, {
  label: string; bg: string; ink: string; border: string; Icon: typeof CheckCircle;
}> = {
  BQ_VERIFIED:    { label: 'Verified', bg: '#E8F6EC', ink: '#1F6B33', border: '#B8DFC2', Icon: CheckCircle },
  ADMIN_APPROVED: { label: 'Verified', bg: '#E8F6EC', ink: '#1F6B33', border: '#B8DFC2', Icon: CheckCircle },
  PENDING:        { label: 'Pending',  bg: '#FFF1DD', ink: '#8C5A14', border: '#F0D7A4', Icon: Clock },
  REJECTED:       { label: 'Rejected', bg: '#FBE8E8', ink: '#8B2F2F', border: '#E8B7B7', Icon: XCircle },
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_TONE[status] || { label: status, bg: '#F1F2F4', ink: '#3F4453', border: '#DCE0E8', Icon: Package }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 'var(--r-pill)',
      background: cfg.bg, color: cfg.ink, border: `1px solid ${cfg.border}`,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      <cfg.Icon size={11} strokeWidth={2.4} /> {cfg.label}
    </span>
  )
}

// Soft neutral chip for meta info (channel, date, price).
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 'var(--r-pill)',
      background: '#F5F4F1',
      border: '1px solid #E8E5DD',
      fontSize: 11, fontWeight: 600, color: '#3A372F',
    }}>
      {children}
    </span>
  )
}

export default async function PurchasesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: purchases }, { data: profile }] = await Promise.all([
    supabase.from('purchase_registrations').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('users').select('tier').eq('id', user.id).maybeSingle(),
  ])
  const userTier = normalizeTier((profile?.tier as string) || 'SILVER')

  return (
    <div className="page-enter" style={{
      paddingTop: 18,
      minHeight: '100vh',
      background: '#fff',
    }}>
      {/* Header */}
      <header style={{ padding: '14px 20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Wardrobe</p>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            <span style={{ fontWeight: 800 }}>สินค้า</span>{' '}
            <span className="serif-i" style={{ fontWeight: 400 }}>ของฉัน</span>
          </h1>
          {purchases && purchases.length > 0 && (
            <p className="serif-i" style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '6px 0 0' }}>
              {purchases.length} items
            </p>
          )}
        </div>
        <Link href="/purchases/register" className="btn btn-ink tap-down" style={{
          padding: '10px 16px', fontSize: 12,
          boxShadow: '0 4px 16px rgba(20,18,15,0.18)',
        }}>
          <Plus size={13} /> ลงทะเบียน
        </Link>
      </header>

      <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!purchases || purchases.length === 0 ? (
          <EmptyState />
        ) : (purchases as PurchaseRegistration[]).map(p => {
          const daysLeft = warrantyDaysLeft(p.warranty_end)
          const wOk = daysLeft > 0
          const ch = CHANNEL[p.channel] || CHANNEL.OTHER
          const projected = calculatePoints(p.total_amount || 0, userTier, p.channel)
          const earnedPts = p.points_awarded || 0
          const showProjected = earnedPts === 0 && projected > 0
          const isPending = p.status === 'PENDING'

          // Warranty progress: % of original warranty period still remaining.
          // Falls back to a 365-day default if warranty_start is missing.
          let warrantyTotal = 365
          if (p.warranty_start && p.warranty_end) {
            const ms = new Date(p.warranty_end).getTime() - new Date(p.warranty_start).getTime()
            const days = Math.round(ms / 86400000)
            if (days > 0) warrantyTotal = days
          }
          const warrantyPct = wOk ? Math.min(100, Math.max(2, (daysLeft / warrantyTotal) * 100)) : 0
          const isExpiringSoon = wOk && daysLeft <= 30
          const accentTone =
            isExpiringSoon ? { from: '#F0D7A4', to: '#8C5A14' } :
            wOk            ? { from: '#EADBB1', to: '#A0782B' } :
                             { from: '#E1E3E8', to: '#9CA3AF' }

          return (
            <Link key={p.id} href={`/purchases/${p.id}`}
              className="tap-down purchase-card" style={{
                position: 'relative',
                overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block',
                background: '#fff',
                border: '1px solid var(--hair)',
                borderRadius: 'var(--r-lg)',
                boxShadow: '0 2px 12px rgba(20,18,15,0.04), 0 1px 2px rgba(20,18,15,0.03)',
                transition: 'box-shadow 0.18s ease, transform 0.18s ease',
              }}>
              {/* Top accent line — gold for active warranty, neutral otherwise.
                  Subtly signals premium status & differentiates expiring items. */}
              <div aria-hidden style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent 0%, ${accentTone.from} 25%, ${accentTone.to} 50%, ${accentTone.from} 75%, transparent 100%)`,
                opacity: wOk ? 1 : 0.5,
              }} />

              <div style={{ padding: '18px 18px 16px' }}>
                {/* Header — channel avatar + title + status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <div aria-hidden style={{
                    flexShrink: 0,
                    width: 46, height: 46, borderRadius: 13,
                    background: 'linear-gradient(160deg, #FAFAF8 0%, #F0EFEB 100%)',
                    border: '1px solid var(--hair)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 2px rgba(20,18,15,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-soft)',
                  }}>
                    <ch.Icon size={20} strokeWidth={1.7} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="display" style={{
                      margin: '0 0 5px', fontSize: 16.5, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.005em',
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                    }}>
                      {p.model_name || p.order_sn}
                    </h3>
                    <p style={{
                      fontSize: 10.5, color: 'var(--ink-faint)', margin: 0,
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.order_sn}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
                    <StatusPill status={p.status} />
                    <ChevronRight size={15} color="var(--ink-faint)" />
                  </div>
                </div>

                {/* Meta chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <Chip>
                    <ch.Icon size={11} strokeWidth={2} /> {ch.label}
                  </Chip>
                  {p.purchase_date && (
                    <Chip>
                      <CalendarDays size={11} strokeWidth={2} /> {formatDate(p.purchase_date)}
                    </Chip>
                  )}
                  {(p.total_amount || 0) > 0 && (
                    <Chip>
                      ฿{Number(p.total_amount).toLocaleString()}
                    </Chip>
                  )}
                  {earnedPts > 0 ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 11px', borderRadius: 'var(--r-pill)',
                      background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
                      color: '#1A1815',
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
                      boxShadow: '0 2px 8px rgba(160,120,43,0.30), inset 0 1px 0 rgba(255,250,235,0.7)',
                    }}>
                      <Sparkles size={11} fill="currentColor" /> +{earnedPts.toLocaleString()} pts
                    </span>
                  ) : showProjected ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 'var(--r-pill)',
                      background: '#FFF1DD',
                      color: '#8C5A14',
                      border: '1px solid #F0D7A4',
                      fontSize: 10.5, fontWeight: 700,
                    }}>
                      <Sparkles size={11} /> ~{projected.toLocaleString()} pts (รอยืนยัน)
                    </span>
                  ) : null}
                </div>

                {/* Warranty section with progress bar */}
                {p.warranty_end && (
                  <div style={{
                    marginTop: 14,
                    padding: '11px 13px 12px',
                    background: wOk
                      ? (isExpiringSoon ? '#FFF8EC' : '#F4FAF6')
                      : '#F8F8F7',
                    border: `1px solid ${wOk ? (isExpiringSoon ? '#F0D7A4' : '#D7EBDD') : 'var(--hair)'}`,
                    borderRadius: 'var(--r-md)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: wOk ? 8 : 0 }}>
                      <ShieldCheck
                        size={14}
                        color={wOk ? (isExpiringSoon ? '#8C5A14' : '#1F6B33') : 'var(--ink-faint)'}
                        strokeWidth={2.2}
                      />
                      <p style={{
                        fontSize: 12, fontWeight: 700, margin: 0,
                        color: wOk ? (isExpiringSoon ? '#8C5A14' : '#1F6B33') : 'var(--ink-mute)',
                      }}>
                        {wOk ? (isExpiringSoon ? 'ประกันใกล้หมด' : 'ประกันยังมีผล') : 'ประกันหมดอายุ'}
                      </p>
                      {wOk && (
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: 11, fontWeight: 800,
                          color: isExpiringSoon ? '#8C5A14' : '#1F6B33',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {daysLeft} วัน
                        </span>
                      )}
                    </div>

                    {/* Visual progress bar — fills with the same accent colour as the top
                        edge so the whole card reads as a single coherent piece. */}
                    {wOk && (
                      <>
                        <div style={{
                          height: 5, borderRadius: 100, overflow: 'hidden',
                          background: isExpiringSoon ? 'rgba(140,90,20,0.12)' : 'rgba(31,107,51,0.12)',
                        }}>
                          <div style={{
                            height: '100%', width: `${warrantyPct}%`,
                            background: isExpiringSoon
                              ? 'linear-gradient(90deg, #C58726, #E0A847)'
                              : 'linear-gradient(90deg, #2E8B47, #4FAA68)',
                            borderRadius: 100,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <p className="serif-i" style={{
                          fontSize: 10.5, color: 'var(--ink-mute)',
                          margin: '7px 0 0',
                        }}>
                          ถึง {formatDate(p.warranty_end)}
                        </p>
                      </>
                    )}
                    {!wOk && (
                      <p className="serif-i" style={{
                        fontSize: 10.5, color: 'var(--ink-mute)',
                        margin: '4px 0 0', paddingLeft: 22,
                      }}>
                        ถึง {formatDate(p.warranty_end)}
                      </p>
                    )}
                  </div>
                )}

                {/* Pending notice */}
                {isPending && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginTop: 12, padding: '9px 12px',
                    background: '#FFF1DD',
                    border: '1px solid #F0D7A4',
                    borderRadius: 'var(--r-md)',
                  }}>
                    <AlertCircle size={13} color="#8C5A14" />
                    <p style={{ fontSize: 11, color: '#8C5A14', margin: 0, fontWeight: 600 }}>
                      กำลังตรวจสอบ · ใช้เวลาสูงสุด 6 ชั่วโมง
                    </p>
                  </div>
                )}
              </div>

              {/* Points earned ribbon — refined with subtle radial highlight */}
              {p.points_awarded > 0 && (
                <div style={{
                  position: 'relative',
                  background: 'linear-gradient(90deg, #14120F 0%, #2A2419 60%, #3A2E18 100%)',
                  padding: '12px 18px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  overflow: 'hidden',
                }}>
                  {/* Subtle gold spotlight on the right side */}
                  <div aria-hidden style={{
                    position: 'absolute', top: -20, right: -20,
                    width: 100, height: 100, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(160,120,43,0.35) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }} />
                  <span style={{
                    position: 'relative',
                    fontSize: 10, color: 'rgba(255,250,235,0.55)',
                    letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <Sparkles size={11} color="rgba(234,219,177,0.7)" /> คะแนนที่ได้รับ
                  </span>
                  <span className="numerals" style={{
                    position: 'relative',
                    fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em',
                    background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  }}>
                    +{p.points_awarded.toLocaleString()}
                  </span>
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      overflow: 'hidden',
      background: '#fff',
      border: '1px solid var(--hair)',
      borderRadius: 'var(--r-lg)',
      boxShadow: '0 2px 12px rgba(20,18,15,0.04)',
    }}>
      <div style={{ padding: '56px 28px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, margin: '0 auto 18px',
          borderRadius: 22,
          background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1A1815',
          boxShadow: '0 8px 24px rgba(160,120,43,0.30), inset 0 1px 0 rgba(255,250,235,0.7)',
        }}>
          <Package size={28} strokeWidth={1.6}/>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800 }}>
          <span>ยังไม่มี</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>สินค้า</span>
        </h3>
        <p className="serif-i" style={{
          fontSize: 12.5, color: 'var(--ink-mute)', margin: '0 0 22px',
          lineHeight: 1.7, maxWidth: 280, marginInline: 'auto',
        }}>
          ลงทะเบียนสินค้า Dreame ของคุณ<br/>เพื่อรับการประกัน + คะแนนสะสม
        </p>
        <Link href="/purchases/register" className="btn btn-ink tap-down" style={{
          display: 'inline-flex', padding: '10px 22px', fontSize: 13,
          gap: 6, boxShadow: '0 6px 20px rgba(20,18,15,0.20)',
        }}>
          <Plus size={14} /> ลงทะเบียนสินค้า
        </Link>
      </div>
    </div>
  )
}
