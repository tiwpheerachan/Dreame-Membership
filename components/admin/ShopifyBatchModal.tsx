'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Sparkles, AlertTriangle, CheckCircle,
  Download, Plus, Copy, ExternalLink,
} from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'create' | 'import'

type CreateForm = {
  title: string
  description: string
  value_type: 'percentage' | 'fixed_amount'
  value: string
  min_purchase: string
  ends_at: string
  code_prefix: string
  code_suffix: string              // เช่น "TH" → DREAME-A1B2-TH
  code_length: string              // ความยาว random ตรงกลาง
  recipient_tier: '' | 'SILVER' | 'GOLD' | 'PLATINUM'
  recipient_segment: '' | 'all_active' | 'vip'
  // Advanced Shopify settings
  one_use_per_customer: boolean
  usage_limit: string                    // ''  = unlimited
  combines_product:  boolean
  combines_order:    boolean
  combines_shipping: boolean
}

type ImportForm = {
  price_rule_id: string
  assign_tier: '' | 'SILVER' | 'GOLD' | 'PLATINUM'
  assign_segment: '' | 'all_active' | 'vip'
}

type SuccessState = {
  mode: 'create' | 'import'
  count: number
  price_rule_id: number
  title?: string
  sample: string[]
  apply_url_pattern?: string
  assigned?: number
  unassigned?: number
}

const defaultCreate: CreateForm = {
  title: '', description: '',
  value_type: 'percentage', value: '10', min_purchase: '0',
  ends_at: '', code_prefix: 'DREAME', code_suffix: '', code_length: '6',
  recipient_tier: '', recipient_segment: '',
  one_use_per_customer: true,
  usage_limit: '',
  // ค่า default ที่ "ใจดี" — combines กับ order discounts ได้
  // (กันเคส testtiw ที่เจอปัญหา) — admin override ได้
  combines_product: false,
  combines_order:   true,
  combines_shipping: false,
}
const defaultImport: ImportForm = {
  price_rule_id: '', assign_tier: '', assign_segment: '',
}

export default function ShopifyBatchModal({ open, onClose }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('create')
  const [createForm, setCreateForm] = useState<CreateForm>(defaultCreate)
  const [importForm, setImportForm] = useState<ImportForm>(defaultImport)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<SuccessState | null>(null)

  if (!open) return null

  function close() {
    if (busy) return
    onClose()
    setTab('create'); setCreateForm(defaultCreate); setImportForm(defaultImport)
    setError(''); setDone(null)
  }

  async function submitCreate() {
    setError(''); setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        title: createForm.title,
        description: createForm.description || undefined,
        value_type: createForm.value_type,
        value: Number(createForm.value),
        min_purchase: Number(createForm.min_purchase) || 0,
        ends_at: createForm.ends_at ? new Date(createForm.ends_at).toISOString() : undefined,
        code_prefix: createForm.code_prefix || undefined,
      }
      if (createForm.recipient_tier) payload.recipient_tier = createForm.recipient_tier
      else if (createForm.recipient_segment) payload.recipient_segment = createForm.recipient_segment
      else throw new Error('เลือก audience ก่อน (Tier หรือ Segment)')

      payload.one_use_per_customer = createForm.one_use_per_customer
      if (createForm.usage_limit) payload.usage_limit = Number(createForm.usage_limit)
      if (createForm.code_suffix.trim()) payload.code_suffix = createForm.code_suffix.trim()
      if (createForm.code_length)        payload.code_length = Number(createForm.code_length)
      payload.combines_with = {
        product_discounts:  createForm.combines_product,
        order_discounts:    createForm.combines_order,
        shipping_discounts: createForm.combines_shipping,
      }

      const r = await fetch('/api/admin/coupons/shopify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'สร้างไม่สำเร็จ')

      setDone({
        mode: 'create',
        count: d.count,
        price_rule_id: d.price_rule_id,
        title: d.title,
        sample: d.sample_codes || [],
        apply_url_pattern: d.apply_url_pattern,
      })
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  async function submitImport() {
    setError(''); setBusy(true)
    try {
      const id = Number(importForm.price_rule_id.trim())
      if (!id || !Number.isFinite(id)) throw new Error('price_rule_id ต้องเป็นตัวเลข')

      const payload: Record<string, unknown> = { price_rule_id: id }
      if (importForm.assign_tier) payload.assign_tier = importForm.assign_tier
      else if (importForm.assign_segment) payload.assign_segment = importForm.assign_segment

      const r = await fetch('/api/admin/coupons/shopify/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'นำเข้าไม่สำเร็จ')

      setDone({
        mode: 'import',
        count: d.imported,
        price_rule_id: d.price_rule_id,
        title: d.title,
        sample: d.sample_codes || [],
        assigned: d.assigned,
        unassigned: d.unassigned,
      })
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  function copyAll() {
    if (!done) return
    navigator.clipboard.writeText(done.sample.join('\n'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="admin-card w-full max-w-lg my-6" style={{ padding: 0 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--admin-border-2)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, #95BF47, #5E8E3E)' }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--admin-ink)' }}>
                Shopify Coupon
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--admin-ink-mute)' }}>
                สร้างใหม่ที่ Shopify หรือ import campaign ที่มีอยู่
              </p>
            </div>
          </div>
          <button onClick={close} className="rounded-lg p-1.5"
            style={{ color: 'var(--admin-ink-faint)' }}>
            <X size={16} />
          </button>
        </div>

        {done ? (
          <SuccessView done={done} onCopyAll={copyAll}
            onClose={() => { close(); router.refresh() }} />
        ) : (
          <>
            {/* Tab nav */}
            <div className="flex items-center px-5 pt-3"
              style={{ borderBottom: '1px solid var(--admin-border-2)' }}>
              <TabBtn active={tab === 'create'} onClick={() => setTab('create')}
                icon={<Plus size={13} />} label="สร้างใหม่" />
              <TabBtn active={tab === 'import'} onClick={() => setTab('import')}
                icon={<Download size={13} />} label="Import จาก Shopify" />
            </div>

            {tab === 'create' ? (
              <CreateTab form={createForm} setForm={setCreateForm}
                onSubmit={submitCreate} busy={busy} error={error} onCancel={close} />
            ) : (
              <ImportTab form={importForm} setForm={setImportForm}
                onSubmit={submitImport} busy={busy} error={error} onCancel={close} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub: Tab button ──
function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative"
      style={{ color: active ? 'var(--admin-ink)' : 'var(--admin-ink-mute)' }}>
      {icon} {label}
      {active && (
        <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]"
          style={{ background: 'var(--admin-ink)' }} />
      )}
    </button>
  )
}

// ── Sub: Create tab ──
function CreateTab({ form, setForm, onSubmit, busy, error, onCancel }: {
  form: CreateForm; setForm: (f: CreateForm | ((p: CreateForm) => CreateForm)) => void
  onSubmit: () => void; busy: boolean; error: string; onCancel: () => void
}) {
  function update<K extends keyof CreateForm>(k: K, v: CreateForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }
  return (
    <div className="p-5 space-y-3.5">
      <Field label="ชื่อ Campaign *">
        <input className="admin-field" value={form.title}
          onChange={e => update('title', e.target.value)}
          placeholder="เช่น Welcome Voucher June 2026" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ชนิดส่วนลด">
          <select className="admin-field" value={form.value_type}
            onChange={e => update('value_type', e.target.value as 'percentage' | 'fixed_amount')}>
            <option value="percentage">% เปอร์เซ็นต์</option>
            <option value="fixed_amount">฿ ส่วนลดบาท</option>
          </select>
        </Field>
        <Field label={form.value_type === 'percentage' ? 'มูลค่า (%) *' : 'มูลค่า (บาท) *'}>
          <input className="admin-field" type="number" value={form.value}
            onChange={e => update('value', e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ขั้นต่ำ (บาท)">
          <input className="admin-field" type="number" value={form.min_purchase}
            onChange={e => update('min_purchase', e.target.value)} />
        </Field>
        <Field label="หมดอายุ (default +90d)">
          <input className="admin-field" type="date" value={form.ends_at}
            onChange={e => update('ends_at', e.target.value)} />
        </Field>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--admin-ink-mute)' }}>
          รูปแบบรหัสคูปอง
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Prefix">
            <input className="admin-field w-full" value={form.code_prefix}
              onChange={e => update('code_prefix', e.target.value.toUpperCase())}
              placeholder="DREAME" />
          </Field>
          <Field label="ความยาวกลาง">
            <input className="admin-field w-full" type="number" min={4} max={12}
              value={form.code_length}
              onChange={e => update('code_length', e.target.value)} />
          </Field>
          <Field label="Suffix">
            <input className="admin-field w-full" value={form.code_suffix}
              onChange={e => update('code_suffix', e.target.value.toUpperCase())}
              placeholder="TH (optional)" />
          </Field>
        </div>
        <CodePreview prefix={form.code_prefix} length={Number(form.code_length) || 6} suffix={form.code_suffix} />
      </div>
      <Field label="คำอธิบาย">
        <input className="admin-field" value={form.description}
          onChange={e => update('description', e.target.value)}
          placeholder="ของขวัญพิเศษ Platinum" />
      </Field>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--admin-ink-mute)' }}>
          Audience — เลือกอย่างใดอย่างหนึ่ง
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ตาม Tier">
            <select className="admin-field" value={form.recipient_tier}
              onChange={e => {
                update('recipient_tier', e.target.value as CreateForm['recipient_tier'])
                if (e.target.value) update('recipient_segment', '')
              }}>
              <option value="">—</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
            </select>
          </Field>
          <Field label="หรือ Segment">
            <select className="admin-field" value={form.recipient_segment}
              onChange={e => {
                update('recipient_segment', e.target.value as CreateForm['recipient_segment'])
                if (e.target.value) update('recipient_tier', '')
              }}>
              <option value="">—</option>
              <option value="all_active">Active ทั้งหมด</option>
              <option value="vip">VIP เท่านั้น</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ─── Advanced: Combinations + usage limits ─── */}
      <details className="rounded-lg" style={{ border: '1px solid var(--admin-border-2)' }}>
        <summary className="cursor-pointer px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider select-none"
          style={{ color: 'var(--admin-ink-mute)' }}>
          การตั้งค่าเเบบ Shopify (รวมส่วนลด, จำกัดการใช้)
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-3">
          <div>
            <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--admin-ink)' }}>
              Combinations — ใช้ร่วมกับส่วนลดอื่นได้ไหม
            </p>
            <div className="space-y-1.5">
              <Toggle
                checked={form.combines_order}
                onChange={v => update('combines_order', v)}
                label="Order discounts"
                hint='รวมกับโปร "ฉลองสุดมันส์ที่หน้าเว็บ" ได้ — ✅ แนะนำเปิด'
              />
              <Toggle
                checked={form.combines_product}
                onChange={v => update('combines_product', v)}
                label="Product discounts"
                hint="รวมกับส่วนลดในสินค้าได้"
              />
              <Toggle
                checked={form.combines_shipping}
                onChange={v => update('combines_shipping', v)}
                label="Shipping discounts"
                hint="รวมกับส่วนลดค่าส่งได้"
              />
            </div>
          </div>

          <div className="h-px" style={{ background: 'var(--admin-border-2)' }} />

          <div>
            <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--admin-ink)' }}>
              จำกัดการใช้
            </p>
            <Toggle
              checked={form.one_use_per_customer}
              onChange={v => update('one_use_per_customer', v)}
              label="1 ครั้งต่อ user"
              hint="ตรงกับ Shopify: Limit to one use per customer"
            />
            <div className="mt-2">
              <Field label="จำกัดการใช้ทั้งหมด (รวมทุก customer)" hint="ว่างไว้ = unlimited">
                <input className="admin-field" type="number" min={0} value={form.usage_limit}
                  onChange={e => update('usage_limit', e.target.value)}
                  placeholder="เช่น 100 = ใช้ได้ 100 ครั้งรวมทุกคน" />
              </Field>
            </div>
          </div>
        </div>
      </details>

      {error && <ErrorBanner msg={error} />}

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="admin-btn admin-btn-ghost flex-1">ยกเลิก</button>
        <button onClick={onSubmit} disabled={busy || !form.title || !form.value}
          className="admin-btn admin-btn-ink flex-1">
          {busy ? 'กำลังสร้าง…' : 'สร้าง batch'}
        </button>
      </div>
    </div>
  )
}

function CodePreview({ prefix, length, suffix }: {
  prefix: string; length: number; suffix: string
}) {
  // สุ่ม 3 ตัวอย่างให้ admin เห็นรูปแบบจริง
  const samples = useMemo(() => {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const make = () => {
      let mid = ''
      const len = Math.max(4, Math.min(12, length || 6))
      for (let i = 0; i < len; i++) mid += abc[Math.floor(Math.random() * abc.length)]
      const parts = [prefix.trim(), mid, suffix.trim()].filter(p => p && p.length > 0)
      return parts.join('-').toUpperCase()
    }
    return [make(), make(), make()]
  }, [prefix, length, suffix])

  return (
    <div className="mt-2 px-3 py-2 rounded-lg flex items-center gap-2 flex-wrap"
      style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border-2)' }}>
      <span className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--admin-ink-faint)' }}>Preview:</span>
      {samples.map((s, i) => (
        <code key={i} className="font-mono text-[11px] px-2 py-0.5 rounded"
          style={{ background: 'var(--admin-card)', color: 'var(--admin-gold-deep)' }}>
          {s}
        </code>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer py-1.5">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2 }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--admin-ink)' }}>{label}</p>
        {hint && (
          <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--admin-ink-faint)' }}>{hint}</p>
        )}
      </div>
    </label>
  )
}

// ── Sub: Import tab ──
function ImportTab({ form, setForm, onSubmit, busy, error, onCancel }: {
  form: ImportForm; setForm: (f: ImportForm | ((p: ImportForm) => ImportForm)) => void
  onSubmit: () => void; busy: boolean; error: string; onCancel: () => void
}) {
  function update<K extends keyof ImportForm>(k: K, v: ImportForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }
  return (
    <div className="p-5 space-y-3.5">
      <div className="rounded-lg px-3 py-2.5 text-xs"
        style={{ background: 'rgba(74,123,193,0.06)', border: '1px solid rgba(74,123,193,0.20)', color: '#4A7BC1' }}>
        💡 ใช้เมื่อสร้าง campaign ใน Shopify โดยตรง (หรือผ่าน app อื่น) แล้วอยากให้ Dreame Membership รู้จัก
      </div>

      <Field label="Price Rule ID *">
        <input className="admin-field" value={form.price_rule_id}
          onChange={e => update('price_rule_id', e.target.value)}
          placeholder="เช่น 1666018017572"
          inputMode="numeric" />
        <p className="text-[10px] mt-1.5" style={{ color: 'var(--admin-ink-faint)' }}>
          หาได้จาก Shopify admin → Discounts → คลิก campaign → URL จะมี id นี้
        </p>
      </Field>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--admin-ink-mute)' }}>
          แจกให้ user ทันที (optional — ไม่เลือกก็ได้)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ตาม Tier">
            <select className="admin-field" value={form.assign_tier}
              onChange={e => {
                update('assign_tier', e.target.value as ImportForm['assign_tier'])
                if (e.target.value) update('assign_segment', '')
              }}>
              <option value="">— ไม่แจก (เก็บ pool)</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
            </select>
          </Field>
          <Field label="หรือ Segment">
            <select className="admin-field" value={form.assign_segment}
              onChange={e => {
                update('assign_segment', e.target.value as ImportForm['assign_segment'])
                if (e.target.value) update('assign_tier', '')
              }}>
              <option value="">—</option>
              <option value="all_active">Active ทั้งหมด</option>
              <option value="vip">VIP เท่านั้น</option>
            </select>
          </Field>
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--admin-ink-faint)' }}>
          ถ้าไม่เลือก audience → import เข้า DB แบบ pool (user_id = null) ค่อยแจกทีหลังได้
        </p>
      </div>

      {error && <ErrorBanner msg={error} />}

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="admin-btn admin-btn-ghost flex-1">ยกเลิก</button>
        <button onClick={onSubmit} disabled={busy || !form.price_rule_id}
          className="admin-btn admin-btn-ink flex-1">
          {busy ? 'กำลังนำเข้า…' : 'Import campaign'}
        </button>
      </div>
    </div>
  )
}

// ── Success view ──
function SuccessView({ done, onCopyAll, onClose }: {
  done: SuccessState; onCopyAll: () => void; onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  function copyOne(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(58,142,90,0.12)' }}>
          <CheckCircle size={22} style={{ color: '#3A8E5A' }} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-base" style={{ color: 'var(--admin-ink)' }}>
            {done.mode === 'create' ? 'สร้างสำเร็จ' : 'Import สำเร็จ'} {done.count} codes
          </p>
          {done.title && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
              {done.title} · #{done.price_rule_id}
            </p>
          )}
          {done.mode === 'import' && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--admin-ink-faint)' }}>
              แจกแล้ว {done.assigned} · pool {done.unassigned}
            </p>
          )}
        </div>
      </div>

      {/* Sample codes */}
      {done.sample.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-4"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
          <div className="px-3 py-2 flex justify-between items-center"
            style={{ borderBottom: '1px solid var(--admin-border-2)' }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: 'var(--admin-ink-mute)' }}>
              ตัวอย่าง code (แสดง {done.sample.length})
            </p>
            <button onClick={onCopyAll}
              className="text-[11px] flex items-center gap-1 transition-colors"
              style={{ color: 'var(--admin-gold)' }}>
              <Copy size={11} /> Copy all
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {done.sample.map(c => (
              <div key={c}
                className="px-3 py-2 flex items-center justify-between text-xs"
                style={{ borderBottom: '1px solid var(--admin-border-2)' }}>
                <span className="font-mono" style={{ color: 'var(--admin-ink-soft)' }}>{c}</span>
                <button onClick={() => copyOne(c)}
                  className="rounded p-1 transition-colors"
                  style={{ color: 'var(--admin-ink-faint)' }}>
                  {copied ? <CheckCircle size={12} style={{ color: '#3A8E5A' }} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[11px] space-y-1 mb-4" style={{ color: 'var(--admin-ink-mute)' }}>
        <p>• แต่ละ user ที่ตรงเงื่อนไขจะเห็นคูปองที่ <strong>/coupons</strong> ทันที</p>
        <p>• เปิด apply URL → Shopify pre-apply code ที่ checkout</p>
        <p>• Cron จะ sync ทุก 10 นาที → coupon ที่ใช้แล้วจะหายจาก list</p>
      </div>

      <div className="flex gap-2">
        <a href={`https://admin.shopify.com/store/dreame-thailand/discounts/${done.price_rule_id}`}
          target="_blank" rel="noopener noreferrer"
          className="admin-btn admin-btn-ghost flex-1">
          <ExternalLink size={11} /> ดูใน Shopify
        </a>
        <button onClick={onClose} className="admin-btn admin-btn-ink flex-1">
          เรียบร้อย
        </button>
      </div>
    </div>
  )
}

// ── Small helpers ──
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--admin-ink-mute)' }}>{label}</label>
      {hint && (
        <p className="text-[10px] mb-1" style={{ color: 'var(--admin-ink-faint)' }}>{hint}</p>
      )}
      {children}
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
      style={{ background: '#FBE9E9', color: '#B14242' }}>
      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
      <p className="text-xs">{msg}</p>
    </div>
  )
}
