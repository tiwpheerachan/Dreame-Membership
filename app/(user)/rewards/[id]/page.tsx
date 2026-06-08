'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Gift, Lock, AlertCircle, CheckCircle,
  Truck, Sparkles, RefreshCw, Clock, Info,
} from 'lucide-react'

type RedeemType = 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM'

interface Reward {
  id: string
  name: string
  short_description: string | null
  description: string | null
  image_url: string | null
  points_required: number
  stock: number | null
  stock_remaining: number | null
  allowed_tiers: string[]
  terms: string | null
  redemption_limit_per_user: number | null
  ends_at: string | null
  can_redeem: boolean
  reason_blocked: string | null
  my_redeem_count: number
  // 3 modes
  redeem_type: RedeemType
  cash_top_up_thb: number | null
  original_price_thb: number | null
  voucher_value_thb: number | null
  voucher_min_purchase_thb: number | null
  shopify_product_url: string | null
  code_validity_days: number | null
}

interface AddressForm {
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  shipping_subdistrict: string
  shipping_district: string
  shipping_province: string
  shipping_postcode: string
  shipping_note: string
}

const TH_PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา',
  'ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก',
  'นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ',
  'บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พังงา','พัทลุง',
  'พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','พะเยา','ภูเก็ต','มหาสารคาม','มุกดาหาร',
  'แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน',
  'เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว',
  'สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู',
  'อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
]

export default function RewardDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [reward, setReward] = useState<Reward | null>(null)
  const [profile, setProfile] = useState<{ tier: string; total_points: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{
    redemption_id: string; points_after: number;
    redeem_type?: RedeemType;
    code?: string | null; apply_url?: string | null;
    code_expires_at?: string | null;
    cash_top_up_thb?: number | null; voucher_value_thb?: number | null;
    shopify_product_url?: string | null;
    // realtime price info
    live_price?: number | null;
    sale_detected?: boolean;
    discount_applied?: number | null;
  } | null>(null)
  const [form, setForm] = useState<AddressForm>({
    shipping_name: '', shipping_phone: '', shipping_address: '',
    shipping_subdistrict: '', shipping_district: '', shipping_province: '',
    shipping_postcode: '', shipping_note: '',
  })

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/rewards', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      const found = (d.rewards || []).find((x: Reward) => x.id === params.id)
      if (!found) throw new Error('ไม่พบของรางวัล')
      setReward(found)
      setProfile(d.profile)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [params.id])

  function set<K extends keyof AddressForm>(k: K, v: AddressForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function submit() {
    setSubmitting(true); setError('')
    try {
      const r = await fetch(`/api/rewards/${params.id}/redeem`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setSuccess(d)
    } catch (e) { setError((e as Error).message) }
    finally { setSubmitting(false) }
  }

  if (success) {
    const hasCode = !!success.code
    return (
      <div className="page-enter" style={{ padding: '40px 20px', textAlign: 'center', minHeight: '100vh' }}>
        <div style={{
          width: 72, height: 72, margin: '0 auto 18px',
          borderRadius: '50%', background: 'rgba(94,142,62,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle size={36} color="#3A8E5A" strokeWidth={1.5} />
        </div>
        <h2 style={{ margin: 0, fontSize: 24 }}>
          <span style={{ fontWeight: 800 }}>แลกสำเร็จ</span>
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-mute)', margin: '8px 0 22px' }}>
          {success.redeem_type === 'POINTS_CASH' ? 'นำรหัสไปใช้ที่ Shopify เพื่อจ่ายส่วนเพิ่ม' :
           success.redeem_type === 'VOUCHER'     ? 'รหัสคูปองพร้อมใช้ที่ Shopify checkout' :
                                                   'เราจะติดต่อจัดส่งภายใน 7-14 วันทำการ'}
        </p>

        {/* Code card */}
        {hasCode && (
          <div className="card-product" style={{
            padding: 16, maxWidth: 360, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, var(--gold-glow), transparent)',
            border: '1px solid var(--gold-line)',
          }}>
            <p style={{ fontSize: 10, color: 'var(--gold-deep)', letterSpacing: '0.16em',
              textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
              {success.redeem_type === 'POINTS_CASH'
                ? `รหัสส่วนลด (จ่ายเพิ่ม ฿${(success.cash_top_up_thb || 0).toLocaleString()})`
                : `คูปองส่วนลด ฿${(success.voucher_value_thb || 0).toLocaleString()}`}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <code style={{
                flex: 1, fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                color: 'var(--gold-deep)', letterSpacing: '0.08em',
                padding: '8px 10px', background: 'var(--surface)',
                borderRadius: 'var(--r-md)', border: '1px dashed var(--gold)',
              }}>
                {success.code}
              </code>
              <button onClick={() => {
                if (success.code) navigator.clipboard.writeText(success.code)
              }} style={{
                padding: '8px 12px', background: 'var(--ink)', color: '#E8C58C',
                border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer',
                fontSize: 11, fontWeight: 700,
              }}>คัดลอก</button>
            </div>
            {success.code_expires_at && (
              <p style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '8px 0 0' }}>
                หมดอายุ {new Date(success.code_expires_at).toLocaleDateString('th-TH')}
              </p>
            )}
            {/* Realtime price detection */}
            {success.redeem_type === 'POINTS_CASH' && success.live_price && (
              <div style={{
                marginTop: 8, padding: '6px 10px',
                background: success.sale_detected ? 'rgba(58,142,90,0.10)' : 'var(--bg-soft)',
                border: `1px solid ${success.sale_detected ? 'rgba(58,142,90,0.25)' : 'var(--hair)'}`,
                borderRadius: 6, fontSize: 10.5, lineHeight: 1.5,
                color: success.sale_detected ? '#3A8E5A' : 'var(--ink-mute)',
              }}>
                {success.sale_detected && '🎉 ตรวจพบโปรลดราคา! '}
                ราคา ณ ขณะนี้: ฿{success.live_price.toLocaleString()}
                {success.discount_applied != null && (
                  <> · ลดให้ ฿{success.discount_applied.toLocaleString()}</>
                )}
                <br/>คุณจ่ายเพียง <b>฿{(success.cash_top_up_thb || 0).toLocaleString()}</b> เป๊ะ
              </div>
            )}
            {(success.apply_url || success.shopify_product_url) && (
              <a
                href={success.redeem_type === 'POINTS_CASH'
                  ? (success.shopify_product_url || success.apply_url || '#')
                  : (success.apply_url || '#')}
                target="_blank" rel="noopener noreferrer"
                className="tap"
                style={{
                  display: 'block', marginTop: 10, padding: '10px 14px',
                  background: '#5E8E3E', color: '#fff',
                  borderRadius: 'var(--r-pill)', fontSize: 12.5, fontWeight: 700,
                  textDecoration: 'none', textAlign: 'center',
                }}>
                {success.redeem_type === 'POINTS_CASH'
                  ? `🛒 ไปที่ Shopify (จ่าย ฿${(success.cash_top_up_thb || 0).toLocaleString()})`
                  : '🛒 ใช้คูปองที่ Shopify'}
              </a>
            )}
          </div>
        )}

        <div className="card-product" style={{ padding: 16, maxWidth: 320, margin: '0 auto', textAlign: 'left' }}>
          <p style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
            แต้มคงเหลือ
          </p>
          <p className="numerals" style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold-deep)', margin: '4px 0 12px' }}>
            {success.points_after.toLocaleString()}
          </p>
          <p style={{ fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', margin: 0 }}>
            #{success.redemption_id.slice(0, 8)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 22 }}>
          <Link href="/redemptions" className="tap" style={btnGhost}>ดูประวัติ</Link>
          <Link href="/rewards" className="tap" style={btnInk}>แลกอื่นต่อ</Link>
        </div>
      </div>
    )
  }

  if (loading || !reward) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)' }}>
        {loading ? 'กำลังโหลด…' : error || 'ไม่พบ'}
      </div>
    )
  }

  return (
    <div className="page-enter">
      {/* Top bar */}
      <div style={{ padding: '14px 16px 0' }}>
        <button onClick={() => router.back()} className="tap"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={14} /> กลับ
        </button>
      </div>

      {/* Hero image */}
      <div style={{
        margin: '14px 16px 0', aspectRatio: '4 / 3',
        background: 'var(--bg-soft)', borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {reward.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reward.image_url} alt={reward.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Gift size={48} color="var(--ink-faint)" strokeWidth={1.4} />
        )}
      </div>

      {/* Title + points */}
      <div style={{ padding: '18px 20px 0' }}>
        <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800 }}>{reward.name}</h1>
        {reward.short_description && (
          <p style={{ fontSize: 13.5, color: 'var(--ink-mute)', margin: '6px 0 0' }}>
            {reward.short_description}
          </p>
        )}

        {/* Price/Cost breakdown card */}
        <div style={{ marginTop: 16, padding: '14px 16px',
          background: 'linear-gradient(135deg, var(--gold-glow), transparent)',
          borderRadius: 'var(--r-lg)', border: '1px solid var(--hair)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
                {reward.redeem_type === 'POINTS_CASH' ? 'ค่าใช้จ่ายแลก' : 'ใช้แต้ม'}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <span className="numerals" style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold-deep)', lineHeight: 1 }}>
                  {reward.points_required.toLocaleString()}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>แต้ม</span>
                {reward.redeem_type === 'POINTS_CASH' && reward.cash_top_up_thb && (
                  <>
                    <span style={{ fontSize: 14, color: 'var(--ink-mute)', margin: '0 2px' }}>+</span>
                    <span className="numerals" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>
                      ฿{Number(reward.cash_top_up_thb).toLocaleString()}
                    </span>
                  </>
                )}
                {reward.redeem_type === 'VOUCHER' && reward.voucher_value_thb && (
                  <>
                    <span style={{ fontSize: 14, color: 'var(--ink-mute)', margin: '0 2px' }}>=</span>
                    <span className="numerals" style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>
                      ฿{Number(reward.voucher_value_thb).toLocaleString()} OFF
                    </span>
                  </>
                )}
              </div>
            </div>
            {profile && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: 0 }}>แต้มคงเหลือ</p>
                <p className="numerals" style={{ fontSize: 16, fontWeight: 700, margin: '2px 0 0',
                  color: profile.total_points >= reward.points_required ? 'var(--green)' : 'var(--red)' }}>
                  {profile.total_points.toLocaleString()}
                </p>
                {profile.total_points < reward.points_required && (
                  <p style={{ fontSize: 9.5, color: 'var(--red)', margin: '2px 0 0' }}>
                    ขาด {(reward.points_required - profile.total_points).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* POINTS_CASH bonus value indicator */}
          {reward.redeem_type === 'POINTS_CASH' && reward.original_price_thb && reward.cash_top_up_thb && (
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--hair)',
              fontSize: 11.5, color: 'var(--ink-mute)', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>ราคาปกติ ฿{Number(reward.original_price_thb).toLocaleString()}</span>
              <span style={{ fontWeight: 700, color: '#3A8E5A' }}>
                ประหยัด ฿{(Number(reward.original_price_thb) - Number(reward.cash_top_up_thb)).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Save-for-later banner — เน้นว่าแลกตอนนี้ใช้ทีหลังได้ */}
        {(reward.redeem_type === 'POINTS_CASH' || reward.redeem_type === 'VOUCHER') && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 'var(--r-md)',
            background: 'rgba(94,142,62,0.08)', border: '1px solid rgba(94,142,62,0.20)',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <Clock size={14} color="#3A8E5A" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 11.5, margin: 0, color: '#3A8E5A', lineHeight: 1.45 }}>
              <b>แลกตอนนี้ ใช้เมื่อไหร่ก็ได้</b>
              <br/>
              <span style={{ color: 'var(--ink-soft)' }}>
                รหัสมีอายุ {reward.code_validity_days || 30} วัน
                {reward.redeem_type === 'POINTS_CASH' && ' · ราคา sync อัตโนมัติทุกครั้งที่ใช้'}
              </span>
            </p>
          </div>
        )}

        {/* Tier badges */}
        <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>เปิดให้:</span>
          {reward.allowed_tiers.map(t => (
            <span key={t} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 'var(--r-pill)',
              background: 'var(--bg-soft)', color: 'var(--ink)', fontWeight: 600,
            }}>{t}</span>
          ))}
        </div>

        {reward.stock !== null && reward.stock_remaining !== null && (
          <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '10px 0 0' }}>
            Stock: {reward.stock_remaining} / {reward.stock}
            {reward.stock_remaining < 10 && (
              <span style={{ color: 'var(--red)', marginLeft: 6, fontWeight: 600 }}>เหลือน้อย!</span>
            )}
          </p>
        )}

        {/* Description */}
        {reward.description && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 700 }}>
              รายละเอียด
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
              {reward.description}
            </p>
          </div>
        )}

        {/* Terms */}
        {reward.terms && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 700 }}>
              เงื่อนไข
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.65, margin: 0, color: 'var(--ink-mute)', whiteSpace: 'pre-wrap' }}>
              {reward.terms}
            </p>
          </div>
        )}

        {/* How-it-works section — โชว์ flow ของ type นี้ */}
        <HowItWorks reward={reward} />

        {/* Shipping note — POINTS_CASH + PREMIUM */}
        {reward.redeem_type !== 'VOUCHER' && (
          <div style={{ marginTop: 22, padding: 12, borderRadius: 'var(--r-md)',
            background: 'var(--bg-soft)', display: 'flex', gap: 10 }}>
            <Truck size={18} color="var(--gold-deep)" />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>จัดส่งตามระบบ Shopify</p>
              <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '2px 0 0' }}>
                {reward.redeem_type === 'PREMIUM'
                  ? 'หลังใช้ code ที่ Shopify ระบบจัดส่งตามที่อยู่ที่กรอกตอน checkout'
                  : 'หลัง user จ่ายค่าส่วนเพิ่มที่ Shopify ระบบจะจัดส่งตามที่อยู่ในเว็บ Shopify'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA — ลอยอยู่เหนือ bottom navbar (navbar z-index = 50, height ~80px) */}
      <div style={{ height: 180 }} />
      {!showForm && (
        <div style={{ position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom))',  // อยู่เหนือ navbar
          left: 0, right: 0,
          padding: '0 16px',
          zIndex: 45,  // ต่ำกว่า navbar (50) เพื่อไม่บัง shadow ของ navbar
          pointerEvents: 'none',  // ให้ contained button รับ click เอง
        }}><div style={{
          maxWidth: 480, margin: '0 auto',
          background: 'var(--surface)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--r-lg)',
          padding: 10,
          boxShadow: '0 8px 24px rgba(14,14,14,0.10)',
          pointerEvents: 'auto',
        }}>
          {!reward.can_redeem ? (
            <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)',
              background: 'var(--bg-soft)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <Lock size={16} color="var(--ink-faint)" />
              <p style={{ fontSize: 12.5, margin: 0, color: 'var(--ink-mute)' }}>
                {reward.reason_blocked}
              </p>
            </div>
          ) : (
            <button onClick={() => {
              // ทุก type ใช้ Shopify code → ไม่ต้องกรอกที่อยู่ตอนแลก
              // ลูกค้าใส่ที่อยู่ตอน checkout ที่ Shopify เอง
              submit()
            }} disabled={submitting}
            className="tap" style={{
              width: '100%', padding: '14px 16px',
              background: submitting ? 'var(--ink-mute)' : 'var(--ink)',
              color: '#E8C58C',
              border: 'none', borderRadius: 'var(--r-pill)',
              fontSize: 14, fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {submitting
                ? <><RefreshCw size={14} className="animate-spin"/> กำลังแลก…</>
                : (
                  <>
                    <Sparkles size={14} />
                    {reward.redeem_type === 'POINTS_CASH' && reward.cash_top_up_thb ? (
                      <>แลกเลย ({reward.points_required} แต้ม + ฿{Number(reward.cash_top_up_thb).toLocaleString()})</>
                    ) : reward.redeem_type === 'VOUCHER' && reward.voucher_value_thb ? (
                      <>แลกเลย ({reward.points_required} แต้ม → ฿{Number(reward.voucher_value_thb).toLocaleString()} off)</>
                    ) : (
                      <>แลกเลย ({reward.points_required.toLocaleString()} แต้ม)</>
                    )}
                  </>
                )}
            </button>
          )}
        </div></div>
      )}

      {/* Address form modal (bottom sheet) */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(14,14,14,0.40)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', width: '100%',
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            maxHeight: '92vh', overflowY: 'auto', paddingBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--hair)',
              position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 5 }}>
              <div style={{ width: 36, height: 4, background: 'var(--ink-ghost)',
                borderRadius: 2, margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>ที่อยู่จัดส่ง</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-mute)' }}>
                ส่งภายในประเทศไทยเท่านั้น
              </p>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormField label="ชื่อ-นามสกุล *">
                <input value={form.shipping_name} onChange={e => set('shipping_name', e.target.value)}
                  style={inputStyle} placeholder="ชื่อจริง นามสกุล" />
              </FormField>
              <FormField label="เบอร์โทรศัพท์ *">
                <input value={form.shipping_phone} onChange={e => set('shipping_phone', e.target.value)}
                  style={inputStyle} placeholder="08X XXX XXXX" />
              </FormField>
              <FormField label="ที่อยู่ * (เลขที่, หมู่, ถนน)">
                <textarea value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)}
                  rows={2} style={inputStyle} placeholder="เช่น 123/45 หมู่ 6 ถ.สุขุมวิท" />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="ตำบล/แขวง">
                  <input value={form.shipping_subdistrict} onChange={e => set('shipping_subdistrict', e.target.value)}
                    style={inputStyle} />
                </FormField>
                <FormField label="อำเภอ/เขต *">
                  <input value={form.shipping_district} onChange={e => set('shipping_district', e.target.value)}
                    style={inputStyle} />
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="จังหวัด *">
                  <select value={form.shipping_province} onChange={e => set('shipping_province', e.target.value)}
                    style={inputStyle}>
                    <option value="">— เลือก —</option>
                    {TH_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </FormField>
                <FormField label="รหัสไปรษณีย์ * (5 หลัก)">
                  <input value={form.shipping_postcode} onChange={e => set('shipping_postcode', e.target.value)}
                    style={inputStyle} maxLength={5} inputMode="numeric" />
                </FormField>
              </div>
              <FormField label="หมายเหตุ (optional)">
                <input value={form.shipping_note} onChange={e => set('shipping_note', e.target.value)}
                  style={inputStyle} placeholder="ฝากไว้กับ รปภ. / โทรก่อนส่ง" />
              </FormField>

              {error && (
                <div style={{ padding: 10, borderRadius: 8,
                  background: '#FBE9E9', color: '#B14242', fontSize: 12,
                  display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <AlertCircle size={13} style={{ marginTop: 1 }} /> {error}
                </div>
              )}

              <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
                <button onClick={() => setShowForm(false)} disabled={submitting}
                  className="tap" style={{ ...btnGhost, flex: 1 }}>
                  ยกเลิก
                </button>
                <button onClick={submit} disabled={submitting} className="tap"
                  style={{ ...btnInk, flex: 1.5 }}>
                  {submitting ? <><RefreshCw size={13} className="animate-spin"/> กำลังแลก…</>
                    : <><CheckCircle size={13}/> ยืนยันใช้ {reward.points_required} แต้ม</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid var(--hair)', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)',
}
const btnGhost: React.CSSProperties = {
  padding: '12px 18px', borderRadius: 'var(--r-pill)',
  background: 'transparent', color: 'var(--ink-mute)',
  border: '1px solid var(--hair)', fontSize: 13, fontWeight: 600,
  textAlign: 'center', textDecoration: 'none', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}
const btnInk: React.CSSProperties = {
  padding: '12px 18px', borderRadius: 'var(--r-pill)',
  background: 'var(--ink)', color: '#E8C58C',
  border: '1px solid var(--ink)', fontSize: 13, fontWeight: 700,
  textAlign: 'center', textDecoration: 'none', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--ink-mute)', marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  )
}

// ============================================================
// How-it-works section — อธิบาย flow ของแต่ละ type ให้ user เข้าใจ
// ============================================================
function HowItWorks({ reward }: { reward: Reward }) {
  const validity = reward.code_validity_days || 30

  // กำหนด config แต่ละ type
  const config = reward.redeem_type === 'POINTS_CASH' ? {
    emoji: '💰', color: '#C99B3E', bg: 'rgba(201,155,62,0.06)', border: 'rgba(201,155,62,0.25)',
    title: 'แลกแล้วใช้เมื่อไหร่ก็ได้',
    badge: 'แต้ม + เงินสด',
    steps: [
      { icon: '✨', text: `กดแลก → หัก ${reward.points_required} แต้มทันที (ไม่ต้องกรอกที่อยู่ในแอป)` },
      { icon: '🎟️', text: 'รหัสส่วนลดเก็บไว้ในแท็บ "คูปอง" ของคุณ' },
      { icon: '⏰', text: `รหัสมีอายุ ${validity} วัน — แลกเก็บไว้ก่อนได้` },
      { icon: '🛒', text: `กดไปที่ Shopify → กรอกที่อยู่จัดส่ง → จ่ายเพียง ฿${Number(reward.cash_top_up_thb || 0).toLocaleString()}` },
      { icon: '✅', text: 'ชำระเงินสำเร็จ — รหัสถูกใช้แล้ว → ปรากฏใน "ประวัติการแลก"' },
    ],
    keyMessage: `ราคาสินค้าเปลี่ยน sale อะไร ไม่ต้องห่วง — กดปุ่ม "sync ราคา" ในประวัติแลก ระบบปรับให้คุณจ่ายเท่ากับ ฿${Number(reward.cash_top_up_thb || 0).toLocaleString()} เสมอ`,
  } : reward.redeem_type === 'VOUCHER' ? {
    emoji: '🎟️', color: '#4A7BC1', bg: 'rgba(74,123,193,0.06)', border: 'rgba(74,123,193,0.25)',
    title: 'แลกเป็นคูปอง — สะสมใช้สบายๆ',
    badge: 'คูปองส่วนลด',
    steps: [
      { icon: '✨', text: `กดแลก → หัก ${reward.points_required} แต้มทันที (ไม่ต้องกรอกที่อยู่)` },
      { icon: '🎟️', text: `ได้คูปอง ฿${Number(reward.voucher_value_thb || 0).toLocaleString()} OFF` },
      { icon: '📲', text: 'คูปองโผล่ทันทีในแท็บ "คูปอง" — ใช้ที่ Shopify ได้เลย' },
      { icon: '⏰', text: `มีอายุ ${validity} วัน — แลกไว้ก่อน ใช้ตอนช้อปจริงก็ได้` },
      { icon: '✅', text: 'ชำระเงินสำเร็จ — คูปองถูกใช้แล้ว → ปรากฏใน "ประวัติการแลก"' },
    ],
    keyMessage: reward.voucher_min_purchase_thb && reward.voucher_min_purchase_thb > 0
      ? `ใช้ได้กับยอดซื้อขั้นต่ำ ฿${Number(reward.voucher_min_purchase_thb).toLocaleString()}`
      : 'ไม่มีขั้นต่ำการใช้',
  } : {
    // PREMIUM — ใช้ Shopify code แบบเดียวกับ POINTS_CASH
    emoji: '🎁', color: '#3A8E5A', bg: 'rgba(58,142,90,0.06)', border: 'rgba(58,142,90,0.25)',
    title: 'แลกของพรีเมียมฟรี — รับที่ Shopify',
    badge: 'ของพรีเมียม',
    steps: [
      { icon: '✨', text: `กดแลก → หัก ${reward.points_required} แต้มทันที (ไม่ต้องกรอกที่อยู่ในแอป)` },
      { icon: '🎟️', text: 'รหัสส่วนลด 100% เก็บไว้ในแท็บ "คูปอง" ของคุณ' },
      { icon: '⏰', text: `รหัสมีอายุ ${validity} วัน — แลกเก็บไว้ก่อนได้` },
      { icon: '🛒', text: 'กดไปที่ Shopify → กรอกที่อยู่จัดส่ง → ไม่ต้องจ่ายค่าสินค้า' },
      { icon: '🚚', text: 'Shopify จัดส่งให้ถึงบ้านตามที่อยู่ที่กรอกตอน checkout' },
    ],
    keyMessage: 'ไม่มีค่าใช้จ่ายเพิ่มสำหรับสินค้า — แต้มล้วน (ค่าส่งตามนโยบาย Shopify)',
  }

  return (
    <div style={{ marginTop: 22 }}>
      <p style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.16em',
        textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 700 }}>
        วิธีการแลก
      </p>

      <div style={{
        padding: 14, borderRadius: 'var(--r-lg)',
        background: config.bg, border: `1px solid ${config.border}`,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>{config.emoji}</span>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
              {config.title}
            </p>
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 'var(--r-pill)',
              background: config.color, color: '#fff', fontWeight: 700,
              display: 'inline-block', marginTop: 4 }}>
              {config.badge}
            </span>
          </div>
        </div>

        {/* Steps */}
        <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {config.steps.map((step, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '6px 0', borderBottom: i < config.steps.length - 1 ? '1px dashed rgba(0,0,0,0.06)' : 'none',
            }}>
              <span style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                background: 'var(--surface)', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: config.color,
                border: `1px solid ${config.border}`,
              }}>{i + 1}</span>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--ink)', flex: 1 }}>
                <span style={{ marginRight: 4 }}>{step.icon}</span>
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        {/* Key message */}
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.6)',
          fontSize: 11, lineHeight: 1.5, color: 'var(--ink-soft)',
        }}>
          💡 <b style={{ color: config.color }}>เคล็ดลับ:</b> {config.keyMessage}
        </div>
      </div>
    </div>
  )
}
