import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Package, Plus, ShieldCheck,
  ShoppingBag, Globe, Store, Sparkles, ChevronRight, Building2,
  CheckCircle, XCircle, Clock,
} from 'lucide-react'
import type { PurchaseRegistration, BQOrderData } from '@/types'
import TrackOrderBanner from '@/components/user/TrackOrderBanner'
import { formatDate, warrantyDaysLeft } from '@/lib/utils'
import { computeWarranty, mainWarrantyMonths } from '@/lib/warranty'
import { calculatePoints, normalizeTier } from '@/lib/points'
import { batchVerifyOrders } from '@/lib/bigquery'

const CHANNEL: Record<string, { Icon: typeof ShoppingBag; label: string }> = {
  SHOPEE:  { Icon: ShoppingBag, label: 'Shopee'   },
  LAZADA:  { Icon: ShoppingBag, label: 'Lazada'   },
  WEBSITE: { Icon: Globe,       label: 'Website'  },
  TIKTOK:  { Icon: Sparkles,    label: 'TikTok'   },
  BRANDSHOP: { Icon: Building2, label: 'Brand Shop' },
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

export default async function PurchasesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: purchasesRaw }, { data: profile }] = await Promise.all([
    supabase.from('purchase_registrations').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('users').select('tier').eq('id', user.id).maybeSingle(),
  ])
  const userTier = normalizeTier((profile?.tier as string) || 'SILVER')

  let purchases = (purchasesRaw || []) as PurchaseRegistration[]

  // ── On-demand verification when the user opens the page ──
  // The hourly cron is the primary path, but it caps at 48 retries
  // (~2 days) so older PENDING orders get abandoned. We also need to
  // backfill stale image_url for already-verified rows that pre-date
  // the image_url change. Fold both into a single batch BQ query.
  //
  //   PENDING + ONLINE       → promote to BQ_VERIFIED, award points,
  //                            remove from cron queue (mirrors cron logic)
  //   BQ_VERIFIED + ONLINE   → just refresh bq_raw_data so image_url lands
  //
  // award_points_for_purchase is idempotent (FOR UPDATE + early-return
  // when points_awarded > 0), so even if the cron races us, no one
  // double-awards.
  const needsBQ = purchases.filter(p =>
    p.channel_type === 'ONLINE' && (
      p.status === 'PENDING' ||
      (p.status === 'BQ_VERIFIED' &&
        !((p.bq_raw_data as BQOrderData | null)?.items?.[0]?.image_url))
    ),
  )
  if (needsBQ.length > 0) {
    try {
      const fresh = await batchVerifyOrders(needsBQ.map(p => p.order_sn))
      const freshBySn = new Map(fresh.map(r => [r.order_sn, r]))
      const service = createServiceClient()

      type Update = { id: string; patch: Partial<PurchaseRegistration> }
      const updates = await Promise.all(needsBQ.map(async (p): Promise<Update | null> => {
        const data = freshBySn.get(p.order_sn)
        if (!data) return null

        if (p.status === 'PENDING') {
          // Full promotion — same logic as cron/verify-pending
          const firstItem = data.items?.[0]
          const purchaseDate = data.order_date ? new Date(data.order_date) : new Date()
          const warrantyEnd = new Date(purchaseDate)
          warrantyEnd.setMonth(warrantyEnd.getMonth() + mainWarrantyMonths(firstItem?.item_name))
          const warrantyStart = purchaseDate.toISOString().split('T')[0]
          const warrantyEndStr = warrantyEnd.toISOString().split('T')[0]
          const purchaseDateStr = data.order_date || null

          const { error } = await service
            .from('purchase_registrations')
            .update({
              bq_verified: true,
              bq_verified_at: new Date().toISOString(),
              bq_raw_data: data,
              status: 'BQ_VERIFIED',
              sku: firstItem?.item_sku || null,
              model_name: firstItem?.item_name || null,
              purchase_date: purchaseDateStr,
              total_amount: data.total_amount,
              warranty_start: warrantyStart,
              warranty_end: warrantyEndStr,
            })
            .eq('id', p.id)
          if (error) return null

          await service.rpc('award_points_for_purchase', { p_purchase_reg_id: p.id })
          await service.from('pending_verifications')
            .delete().eq('purchase_reg_id', p.id)

          return {
            id: p.id,
            patch: {
              status: 'BQ_VERIFIED',
              bq_verified: true,
              bq_raw_data: data,
              sku: firstItem?.item_sku || null,
              model_name: firstItem?.item_name || null,
              purchase_date: purchaseDateStr,
              total_amount: data.total_amount,
              warranty_start: warrantyStart,
              warranty_end: warrantyEndStr,
            },
          }
        }

        // BQ_VERIFIED — only the bq_raw_data needs to be refreshed
        if (data.items?.[0]?.image_url) {
          await service.from('purchase_registrations')
            .update({ bq_raw_data: data })
            .eq('id', p.id)
          return { id: p.id, patch: { bq_raw_data: data } }
        }
        return null
      }))

      const patches = new Map(
        updates.filter((u): u is Update => u !== null).map(u => [u.id, u.patch]),
      )
      // Patch the in-memory copy so the first render shows updated state.
      purchases = purchases.map(p => {
        const patch = patches.get(p.id)
        return patch ? { ...p, ...patch } : p
      })
    } catch (e) {
      console.error('[purchases] BQ enrichment failed:', e)
    }
  }

  return (
    <div className="page-enter" style={{
      paddingTop: 18,
      minHeight: '100vh',
      background: '#fff',
    }}>
      {/* Header */}
      <header style={{ padding: '14px 20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <TrackOrderBanner variant="button" />
          <Link href="/purchases/register" className="btn btn-ink tap-down" style={{
            padding: '10px 16px', fontSize: 12,
            boxShadow: '0 4px 16px rgba(20,18,15,0.18)',
          }}>
            <Plus size={13} /> ลงทะเบียน
          </Link>
        </div>
      </header>

      <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!purchases || purchases.length === 0 ? (
          <EmptyState />
        ) : purchases.map(p => {
          // Headline warranty = main-body tier, derived from the product type
          // and the warranty start (falls back to purchase date). Computing it
          // here keeps older records — stored with a flat 24-month end — correct.
          const wStart = p.warranty_start || p.purchase_date || null
          const wMain = computeWarranty(p.model_name, wStart).tiers.find(t => t.key === 'main')
          const daysLeft = wMain?.daysLeft ?? warrantyDaysLeft(p.warranty_end)
          const mainEnd = wMain?.endDate ?? p.warranty_end
          const wOk = daysLeft > 0
          const ch = CHANNEL[p.channel] || CHANNEL.OTHER
          const projected = calculatePoints(p.total_amount || 0, userTier, p.channel)
          const earnedPts = p.points_awarded || 0
          const showProjected = earnedPts === 0 && projected > 0
          // Pull the product image straight from the BQ payload we cached at
          // registration / cron-verify time. Falls back to the channel icon
          // when BQ didn't return one (e.g. older orders, store sales).
          const bq = p.bq_raw_data as BQOrderData | null
          const productImage = bq?.items?.[0]?.image_url || null

          // Warranty progress: % of original warranty period still remaining.
          // Falls back to a 365-day default if warranty_start is missing.
          let warrantyTotal = 365
          if (wStart && mainEnd) {
            const ms = new Date(mainEnd).getTime() - new Date(wStart).getTime()
            const days = Math.round(ms / 86400000)
            if (days > 0) warrantyTotal = days
          }
          const warrantyPct = wOk ? Math.min(100, Math.max(2, (daysLeft / warrantyTotal) * 100)) : 0
          const isExpiringSoon = wOk && daysLeft <= 30

          return (
            <Link key={p.id} href={`/purchases/${p.id}`}
              className="tap-down purchase-card" style={{
                display: 'flex', gap: 12,
                padding: 12,
                background: '#fff',
                border: '1px solid var(--hair)',
                borderRadius: 14,
                boxShadow: '0 1px 2px rgba(20,18,15,0.04)',
                textDecoration: 'none', color: 'inherit',
                transition: 'box-shadow 0.18s ease, transform 0.18s ease',
              }}>
              {/* Product image (or channel-icon fallback) — compact 76×76 */}
              <div style={{
                flexShrink: 0,
                width: 76, height: 76,
                borderRadius: 12,
                overflow: 'hidden',
                background: 'linear-gradient(160deg, #FAFAF8 0%, #F0EFEB 100%)',
                border: '1px solid var(--hair)',
                position: 'relative',
              }}>
                {productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={productImage} alt={p.model_name || 'product'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div aria-hidden style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-soft)',
                  }}>
                    <ch.Icon size={26} strokeWidth={1.5} />
                  </div>
                )}
                {/* Channel badge — only when image is present (otherwise icon already shows source) */}
                {productImage && (
                  <span aria-hidden style={{
                    position: 'absolute', bottom: 3, right: 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    border: '1px solid rgba(20,18,15,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-soft)',
                  }}>
                    <ch.Icon size={9} strokeWidth={2} />
                  </span>
                )}
              </div>

              {/* Right column — info stack */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Title + status + chevron */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <h3 style={{
                    flex: 1,
                    margin: 0, fontSize: 13.5, fontWeight: 700, lineHeight: 1.35,
                    color: 'var(--ink)',
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                  }}>
                    {p.model_name || p.order_sn}
                  </h3>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0, marginTop: 1 }}>
                    <StatusPill status={p.status} />
                    <ChevronRight size={13} color="var(--ink-faint)" />
                  </div>
                </div>

                {/* Order SN */}
                <p style={{
                  margin: 0, fontSize: 10, color: 'var(--ink-faint)',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.order_sn}
                </p>

                {/* Meta line — channel · date · price · points pill */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: 'var(--ink-mute)',
                  marginTop: 2,
                }}>
                  <span>{ch.label}</span>
                  {p.purchase_date && (
                    <>
                      <span style={{ color: 'var(--ink-ghost)' }}>·</span>
                      <span>{formatDate(p.purchase_date)}</span>
                    </>
                  )}
                  {(p.total_amount || 0) > 0 && (
                    <>
                      <span style={{ color: 'var(--ink-ghost)' }}>·</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 700 }}>
                        ฿{Number(p.total_amount).toLocaleString()}
                      </span>
                    </>
                  )}
                  {earnedPts > 0 ? (
                    <span style={{
                      marginLeft: 'auto',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 8px', borderRadius: 999,
                      background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
                      color: '#1A1815',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
                      boxShadow: '0 1px 4px rgba(160,120,43,0.25), inset 0 1px 0 rgba(255,250,235,0.6)',
                    }}>
                      +{earnedPts.toLocaleString()} pts
                    </span>
                  ) : showProjected ? (
                    <span style={{
                      marginLeft: 'auto',
                      padding: '2px 8px', borderRadius: 999,
                      background: '#FFF1DD', color: '#8C5A14',
                      border: '1px solid #F0D7A4',
                      fontSize: 9.5, fontWeight: 700,
                    }}>
                      ~{projected.toLocaleString()} pts
                    </span>
                  ) : null}
                </div>

                {/* Warranty progress — thin inline bar with day count */}
                {mainEnd && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <ShieldCheck
                      size={11}
                      strokeWidth={2.2}
                      color={wOk ? (isExpiringSoon ? '#8C5A14' : '#1F6B33') : 'var(--ink-faint)'}
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{
                      flex: 1, height: 4, borderRadius: 100, overflow: 'hidden',
                      background: wOk
                        ? (isExpiringSoon ? 'rgba(140,90,20,0.12)' : 'rgba(31,107,51,0.12)')
                        : 'rgba(20,18,15,0.06)',
                    }}>
                      {wOk && (
                        <div style={{
                          height: '100%', width: `${warrantyPct}%`,
                          background: isExpiringSoon
                            ? 'linear-gradient(90deg, #C58726, #E0A847)'
                            : 'linear-gradient(90deg, #2E8B47, #4FAA68)',
                          borderRadius: 100,
                        }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      color: wOk ? (isExpiringSoon ? '#8C5A14' : '#1F6B33') : 'var(--ink-faint)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}>
                      {wOk ? `${daysLeft} วัน` : 'หมดอายุ'}
                    </span>
                  </div>
                )}
              </div>
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
