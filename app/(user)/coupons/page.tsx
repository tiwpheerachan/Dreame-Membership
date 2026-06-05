import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ticket } from 'lucide-react'
import type { Coupon } from '@/types'
import CouponsClient from '@/components/user/CouponsClient'

export const dynamic = 'force-dynamic'

export default async function CouponsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Self-heal: เรียกเฉพาะ user ใหม่ที่ยังไม่เคยมี coupon เลย ──
  // กัน RPC ถูกเรียกทุก page visit ที่ scale 10k+ user
  const { count: existing } = await supabase
    .from('coupons').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (existing === 0) {
    // ดู user สร้างมานานแค่ไหน — ถ้านานเกิน 7 วัน ไม่น่าจะมี coupon ใหม่จากการ self-heal
    // เก่ามาก = บัญชี dormant, ข้าม self-heal เพื่อ scale
    const { data: userMeta } = await supabase
      .from('users').select('created_at, tier').eq('id', user.id).maybeSingle()
    const daysSinceSignup = userMeta?.created_at
      ? (Date.now() - new Date(userMeta.created_at).getTime()) / 86_400_000
      : 0
    if (daysSinceSignup < 7) {
      try {
        const service = createServiceClient()
        await service.rpc('self_heal_user_coupons', { p_user_id: user.id })
      } catch { /* function อาจยังไม่ deploy — ไม่ blocker */ }
    }
  }

  const today = new Date().toISOString().split('T')[0]
  // ไม่โชว์คูปอง paused / archived / draft (filter ตรงนี้แทนใน query
  // เผื่อ DB ยังไม่ apply migration 0015 — กรอง JS-side แทน)
  const { data: coupons } = await supabase
    .from('coupons').select('*').eq('user_id', user.id)
    .order('valid_until', { ascending: true })

  // ── Enrich reward coupons ด้วย redemption metadata (สำหรับ realtime price)
  const service = createServiceClient()
  const rewardCodes = (coupons || [])
    .filter((c: { auto_issue_key?: string | null }) => c.auto_issue_key?.startsWith?.('REWARD_'))
    .map((c: { code: string }) => c.code)
  let rewardMeta: Record<string, {
    redemption_id: string;
    redeem_type: string;
    cash_top_up_thb: number | null;
    shopify_product_url: string | null;
  }> = {}
  if (rewardCodes.length > 0) {
    const { data: reds } = await service.from('redemptions')
      .select('id, shopify_code, reward_id, reward_snapshot')
      .in('shopify_code', rewardCodes).eq('user_id', user.id)

    // ── Fallback: snapshot ไม่ครบ → bulk fetch reward records ──
    const incompleteRewardIds: string[] = []
    for (const r of reds || []) {
      const snap = (r.reward_snapshot || {}) as { redeem_type?: string; cash_top_up_thb?: number; shopify_product_url?: string }
      if (!snap.redeem_type || snap.cash_top_up_thb == null || !snap.shopify_product_url) {
        if (r.reward_id) incompleteRewardIds.push(r.reward_id as string)
      }
    }
    let rewardLookup: Record<string, { redeem_type: string; cash_top_up_thb: number | null; shopify_product_url: string | null }> = {}
    if (incompleteRewardIds.length > 0) {
      const { data: rewards } = await service.from('rewards')
        .select('id, redeem_type, cash_top_up_thb, shopify_product_url')
        .in('id', incompleteRewardIds)
      for (const rw of rewards || []) {
        rewardLookup[rw.id as string] = {
          redeem_type:         rw.redeem_type as string,
          cash_top_up_thb:     rw.cash_top_up_thb as number | null,
          shopify_product_url: rw.shopify_product_url as string | null,
        }
      }
    }

    for (const r of reds || []) {
      const code = r.shopify_code as string
      const snap = (r.reward_snapshot || {}) as { redeem_type?: string; cash_top_up_thb?: number; shopify_product_url?: string }
      const fallback = r.reward_id ? rewardLookup[r.reward_id as string] : undefined
      rewardMeta[code] = {
        redemption_id:       r.id as string,
        redeem_type:         snap.redeem_type || fallback?.redeem_type || 'VOUCHER',
        cash_top_up_thb:     snap.cash_top_up_thb ?? fallback?.cash_top_up_thb ?? null,
        shopify_product_url: snap.shopify_product_url ?? fallback?.shopify_product_url ?? null,
      }
    }
  }

  const all: Coupon[] = ((coupons || []) as Coupon[])
    .filter(c => {
      const s = (c as Coupon & { status?: string }).status
      return !s || s === 'active'
    })
    .map(c => ({ ...c, reward_meta: rewardMeta[c.code] || null }) as Coupon)
  const active  = all.filter(c => !c.used_at && c.valid_until >= today)
  const used    = all.filter(c =>  c.used_at)
  const expired = all.filter(c => !c.used_at && c.valid_until <  today)

  if (active.length === 0 && used.length === 0 && expired.length === 0) {
    return (
      <div className="page-enter" style={{ paddingTop: 18 }}>
        <header style={{ padding: '14px 20px 22px' }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Privilege Vault</p>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            <span style={{ fontWeight: 800 }}>คูปอง</span>{' '}
            <span className="serif-i" style={{ fontWeight: 400 }}>ของฉัน</span>
          </h1>
        </header>
        <div style={{ padding: '0 16px 24px' }}>
          <div className="card-product" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '52px 24px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 18px',
                borderRadius: '50%', background: 'var(--gold-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gold-deep)',
              }}>
                <Ticket size={26} strokeWidth={1.4} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>
                <span style={{ fontWeight: 800 }}>ยังไม่มี</span>{' '}
                <span className="serif-i" style={{ fontWeight: 400 }}>คูปอง</span>
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
                คูปองพิเศษจะปรากฏที่นี่<br/>เมื่อได้รับจาก Dreame
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <CouponsClient active={active} used={used} expired={expired} />
}
