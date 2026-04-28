import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Package, Plus, ShieldCheck, CalendarDays,
  Hash, ShoppingBag, Globe, Store, Sparkles, AlertCircle, ArrowUpRight
} from 'lucide-react'
import type { PurchaseRegistration } from '@/types'
import { formatDate, warrantyDaysLeft } from '@/lib/utils'

const CHANNEL: Record<string, { icon: React.ReactNode; label: string }> = {
  SHOPEE:  { icon: <ShoppingBag size={11}/>, label: 'Shopee'   },
  LAZADA:  { icon: <ShoppingBag size={11}/>, label: 'Lazada'   },
  WEBSITE: { icon: <Globe size={11}/>,       label: 'Website'  },
  TIKTOK:  { icon: <Sparkles size={11}/>,    label: 'TikTok'   },
  STORE:   { icon: <Store size={11}/>,       label: 'หน้าร้าน' },
  OTHER:   { icon: <Package size={11}/>,     label: 'อื่นๆ'    },
}

function StatusPill({ status }: { status: string }) {
  if (status === 'ADMIN_APPROVED' || status === 'BQ_VERIFIED')
    return <span className="pill pill-green">Verified</span>
  if (status === 'PENDING')
    return <span className="pill pill-amber">Pending</span>
  if (status === 'REJECTED')
    return <span className="pill pill-red">Rejected</span>
  return <span className="pill">{status}</span>
}

export default async function PurchasesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: purchases } = await supabase
    .from('purchase_registrations').select('*')
    .eq('user_id', user.id).order('created_at', { ascending: false })

  return (
    <div className="page-enter" style={{ paddingTop: 18 }}>
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
        <Link href="/purchases/register" className="btn btn-ink tap-down" style={{ padding: '10px 16px', fontSize: 12 }}>
          <Plus size={13} /> ลงทะเบียน
        </Link>
      </header>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!purchases || purchases.length === 0 ? (
          <div className="card-product" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '52px 24px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 18px',
                borderRadius: '50%', background: 'var(--gold-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gold-deep)',
              }}>
                <Package size={26} strokeWidth={1.4}/>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>
                <span style={{ fontWeight: 800 }}>ยังไม่มี</span>{' '}
                <span className="serif-i" style={{ fontWeight: 400 }}>สินค้า</span>
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
                ลงทะเบียนสินค้า Dreame ของคุณ<br/>เพื่อรับการประกัน + คะแนนสะสม
              </p>
            </div>
            <Link href="/purchases/register" className="bottom-bar tap-down" style={{
              textDecoration: 'none', justifyContent: 'center', gap: 6, padding: '14px 18px',
            }}>
              <Plus size={14} color="var(--gold-soft)" />
              <span style={{ color: 'var(--gold-soft)', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
                ลงทะเบียนสินค้า
              </span>
            </Link>
          </div>
        ) : (purchases as PurchaseRegistration[]).map(p => {
          const daysLeft = warrantyDaysLeft(p.warranty_end)
          const wOk = daysLeft > 0
          const ch = CHANNEL[p.channel] || CHANNEL.OTHER
          return (
            <article key={p.id} className="card-product" style={{ overflow: 'hidden' }}>
              <div style={{ padding: 18 }}>
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      margin: '0 0 4px', fontSize: 17, fontWeight: 700, lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.model_name || p.order_sn}
                    </h3>
                    <p style={{
                      fontSize: 10.5, color: 'var(--ink-faint)', margin: 0,
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                    }}>
                      {p.order_sn}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </div>

                {/* Meta chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                  <span className="pill">{ch.icon}{ch.label}</span>
                  {p.purchase_date && (
                    <span className="pill"><CalendarDays size={11} />{formatDate(p.purchase_date)}</span>
                  )}
                  {p.serial_number && (
                    <span className="pill"><Hash size={11} />{p.serial_number}</span>
                  )}
                  {p.points_awarded > 0 && (
                    <span className="pill pill-gold">
                      <Sparkles size={11} fill="currentColor" /> +{p.points_awarded} pts
                    </span>
                  )}
                </div>

                {/* Warranty */}
                {p.warranty_end && (
                  <>
                    <div style={{ height: 1, background: 'var(--hair)', margin: '14px 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ShieldCheck size={16} color={wOk ? 'var(--green)' : 'var(--ink-faint)'} strokeWidth={1.6} />
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontSize: 12, fontWeight: 700, margin: '0 0 2px',
                          color: wOk ? 'var(--green)' : 'var(--ink-faint)',
                        }}>
                          {wOk ? 'ประกันยังมีผล' : 'ประกันหมดอายุ'}
                        </p>
                        <p className="serif-i" style={{ fontSize: 11, color: 'var(--ink-mute)', margin: 0 }}>
                          ถึง {formatDate(p.warranty_end)}
                        </p>
                      </div>
                      {wOk && (
                        <span className="pill pill-green">
                          {daysLeft} วัน
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Pending message */}
                {p.status === 'PENDING' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginTop: 14, padding: '10px 12px',
                    background: 'var(--amber-soft)',
                    border: '1px solid rgba(154,110,31,0.20)',
                    borderRadius: 'var(--r-md)',
                  }}>
                    <AlertCircle size={13} color="var(--amber)" />
                    <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0 }}>
                      กำลังตรวจสอบ · ใช้เวลาสูงสุด 6 ชั่วโมง
                    </p>
                  </div>
                )}
              </div>

              {/* Black bottom bar with quick action */}
              {p.points_awarded > 0 && (
                <div className="bottom-bar">
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em' }}>
                    คะแนนที่ได้รับ
                  </span>
                  <span className="numerals" style={{ fontSize: 18, color: 'var(--gold-soft)' }}>
                    +{p.points_awarded.toLocaleString()}
                  </span>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
