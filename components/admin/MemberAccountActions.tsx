'use client'
// ============================================================
// MemberAccountActions — admin edits a customer's profile, and (SUPER_ADMIN)
// sets a password / generates a magic login link to access the account.
// Contact edits (email/phone) sync to auth so the customer's OTP / magic-link
// login uses the new value. Every action is audited server-side.
// ============================================================
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Pencil, Save, X, Loader2, KeyRound, LogIn, Copy, Check, ShieldAlert,
} from 'lucide-react'

interface Props {
  userId: string
  isSuperAdmin: boolean
  initial: {
    full_name: string | null
    email: string | null
    phone: string | null
    address: string | null
    date_of_birth: string | null
  }
}

const cardHeader: React.CSSProperties = {
  fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700,
  letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 10px',
}

export default function MemberAccountActions({ userId, isSuperAdmin, initial }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    full_name: initial.full_name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    address: initial.address || '',
    date_of_birth: initial.date_of_birth || '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ kind: 'err', text: data.error || 'บันทึกไม่สำเร็จ' }); return }
      setMsg({ kind: 'ok', text: 'บันทึกข้อมูลเรียบร้อย' })
      setEditing(false)
      router.refresh()
    } catch { setMsg({ kind: 'err', text: 'เชื่อมต่อไม่ได้' }) }
    finally { setSaving(false) }
  }

  return (
    <div className="admin-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ ...cardHeader, margin: 0 }}>ข้อมูลติดต่อ / บัญชี</p>
        {!editing && (
          <button onClick={() => { setEditing(true); setMsg(null) }} className="admin-btn admin-btn-ghost"
            style={{ padding: '4px 10px', fontSize: 11.5, gap: 5 }}>
            <Pencil size={12} /> แก้ไข
          </button>
        )}
      </div>

      {!editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: 12 }}>
          <Field label="ชื่อ" value={initial.full_name} />
          <Field label="เบอร์ (ใช้ล็อกอิน)" value={initial.phone} mono />
          <Field label="อีเมล (ใช้ล็อกอิน)" value={initial.email} mono />
          <Field label="วันเกิด" value={initial.date_of_birth} />
          <div style={{ gridColumn: '1 / -1' }}><Field label="ที่อยู่" value={initial.address} /></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input label="ชื่อ" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="เบอร์โทร" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} mono placeholder="0812345678" />
            <Input label="วันเกิด" value={form.date_of_birth} onChange={v => setForm(f => ({ ...f, date_of_birth: v }))} type="date" />
          </div>
          <Input label="อีเมล" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} mono placeholder="name@email.com" />
          <Input label="ที่อยู่" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
          <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.5 }}>
            ⚠️ การแก้<strong>อีเมล</strong>จะเปลี่ยนอีเมลล็อกอิน (magic link) ของลูกค้าด้วย · เบอร์เป็นข้อมูลติดต่อ (การล็อกอินด้วยเบอร์ OTP ระบบตั้งค่าเองตอนลูกค้าเข้าระบบ)
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={save} disabled={saving} className="admin-btn admin-btn-ink" style={{ flex: 1, padding: '7px 10px', fontSize: 12, gap: 5 }}>
              {saving ? <Loader2 size={12} className="spinner" /> : <Save size={12} />} บันทึก
            </button>
            <button onClick={() => { setEditing(false); setForm({ full_name: initial.full_name || '', email: initial.email || '', phone: initial.phone || '', address: initial.address || '', date_of_birth: initial.date_of_birth || '' }); setMsg(null) }}
              className="admin-btn admin-btn-ghost" style={{ flex: 1, padding: '7px 10px', fontSize: 12, gap: 5 }}>
              <X size={12} /> ยกเลิก
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: msg.kind === 'ok' ? 'var(--green)' : 'var(--red)' }}>
          {msg.kind === 'ok' ? '✓ ' : '⚠️ '}{msg.text}
        </p>
      )}

      {isSuperAdmin && (
        <SuperAdminActions userId={userId} hasEmail={!!initial.email} />
      )}
    </div>
  )
}

// ── SUPER_ADMIN-only: set password + generate login link ──
function SuperAdminActions({ userId, hasEmail }: { userId: string; hasEmail: boolean }) {
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [linkBusy, setLinkBusy] = useState(false)
  const [link, setLink] = useState('')
  const [linkErr, setLinkErr] = useState('')
  const [copied, setCopied] = useState(false)

  async function setPassword() {
    if (pw.length < 8) { setPwMsg({ kind: 'err', text: 'รหัสผ่านอย่างน้อย 8 ตัวอักษร' }); return }
    setPwBusy(true); setPwMsg(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json()
      if (!res.ok) { setPwMsg({ kind: 'err', text: data.error || 'ตั้งรหัสไม่สำเร็จ' }); return }
      setPwMsg({ kind: 'ok', text: 'ตั้งรหัสผ่านเรียบร้อย' }); setPw(''); setPwOpen(false)
    } catch { setPwMsg({ kind: 'err', text: 'เชื่อมต่อไม่ได้' }) }
    finally { setPwBusy(false) }
  }

  async function genLink() {
    setLinkBusy(true); setLinkErr(''); setLink(''); setCopied(false)
    try {
      const res = await fetch(`/api/admin/users/${userId}/login-link`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setLinkErr(data.error || 'สร้างลิงก์ไม่สำเร็จ'); return }
      setLink(data.link)
    } catch { setLinkErr('เชื่อมต่อไม่ได้') }
    finally { setLinkBusy(false) }
  }

  function copyLink() {
    navigator.clipboard.writeText(link)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--admin-border)' }}>
      <p style={{ ...cardHeader, display: 'flex', alignItems: 'center', gap: 5 }}>
        <ShieldAlert size={11} color="var(--amber)" /> จัดการบัญชี (Super Admin)
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => { setPwOpen(o => !o); setPwMsg(null) }} className="admin-btn admin-btn-ghost"
          style={{ padding: '6px 10px', fontSize: 11.5, gap: 5 }}>
          <KeyRound size={12} /> ตั้ง/เปลี่ยนรหัสผ่าน
        </button>
        <button onClick={genLink} disabled={linkBusy} className="admin-btn admin-btn-ghost"
          style={{ padding: '6px 10px', fontSize: 11.5, gap: 5 }}>
          {linkBusy ? <Loader2 size={12} className="spinner" /> : <LogIn size={12} />} สร้างลิงก์เข้าระบบ
        </button>
      </div>

      {pwOpen && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder="รหัสผ่านใหม่ (≥ 8 ตัว)"
            className="admin-field" style={{ flex: 1, fontSize: 12 }} autoComplete="off" />
          <button onClick={setPassword} disabled={pwBusy} className="admin-btn admin-btn-ink" style={{ padding: '6px 12px', fontSize: 12 }}>
            {pwBusy ? <Loader2 size={12} className="spinner" /> : 'ตั้ง'}
          </button>
        </div>
      )}
      {pwMsg && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: pwMsg.kind === 'ok' ? 'var(--green)' : 'var(--red)' }}>
          {pwMsg.kind === 'ok' ? '✓ ' : '⚠️ '}{pwMsg.text}
        </p>
      )}

      {!hasEmail && (
        <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--ink-mute)' }}>
          * ลิงก์เข้าระบบต้องใช้อีเมล — เพิ่มอีเมลให้ลูกค้าก่อนถ้ายังไม่มี
        </p>
      )}
      {linkErr && <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--red)' }}>⚠️ {linkErr}</p>}
      {link && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input readOnly value={link} className="admin-field" style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)' }}
              onFocus={e => e.currentTarget.select()} />
            <button onClick={copyLink} className="admin-btn admin-btn-ink" style={{ padding: '6px 12px', fontSize: 12, gap: 4 }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--amber)', lineHeight: 1.5 }}>
            ⚠️ เปิดลิงก์นี้ใน<strong>หน้าต่างส่วนตัว (Incognito)</strong> เพื่อเข้าแอคลูกค้า — ถ้าเปิดในหน้าต่างแอดมินปกติ จะถูกสลับเป็นเซสชันลูกค้า · ลิงก์ใช้ได้ครั้งเดียวและหมดอายุเร็ว
          </p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 12, fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all', color: value ? 'var(--ink)' : 'var(--ink-faint)' }}>
        {value || '—'}
      </p>
    </div>
  )
}

function Input({ label, value, onChange, mono, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; mono?: boolean; type?: string; placeholder?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 9.5, color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="admin-field" style={{ width: '100%', marginTop: 3, fontSize: 12, fontFamily: mono ? 'var(--font-mono)' : 'inherit' }} />
    </label>
  )
}
