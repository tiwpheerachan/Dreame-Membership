'use client'
import { useState, useEffect } from 'react'
import { Plus, X, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Staff {
  id: string; auth_user_id?: string; name: string; email: string;
  role: string; channel_access: string[]; is_active: boolean; created_at: string;
}

const ROLES = [
  { value: 'SUPER_ADMIN',  label: 'Super Admin' },
  { value: 'ADMIN_ONLINE', label: 'Admin Online' },
  { value: 'ADMIN_ONSITE', label: 'Admin Onsite' },
  { value: 'STAFF_ONLINE', label: 'Staff Online' },
  { value: 'STAFF_ONSITE', label: 'Staff Onsite' },
]

const ROLE_PILL: Record<string, string> = {
  SUPER_ADMIN:  'admin-pill admin-pill-gold',
  ADMIN_ONLINE: 'admin-pill admin-pill-blue',
  ADMIN_ONSITE: 'admin-pill admin-pill-blue',
  STAFF_ONLINE: 'admin-pill',
  STAFF_ONSITE: 'admin-pill',
}

export default function AdminStaffPage() {
  const [list, setList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [edit, setEdit] = useState<Staff | null>(null)
  const [form, setForm] = useState({ email: '', name: '', role: 'STAFF_ONLINE', online: true, onsite: false })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/staff')
    const d = await r.json()
    if (r.ok) setList(d.staff || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEdit(null)
    setForm({ email: '', name: '', role: 'STAFF_ONLINE', online: true, onsite: false })
    setShowForm(true); setMsg('')
  }
  function openEdit(s: Staff) {
    setEdit(s)
    setForm({
      email: s.email, name: s.name, role: s.role,
      online: s.channel_access.includes('ONLINE'),
      onsite: s.channel_access.includes('ONSITE'),
    })
    setShowForm(true); setMsg('')
  }

  async function save() {
    setSaving(true); setMsg('')
    const channel_access = [
      ...(form.online ? ['ONLINE'] : []),
      ...(form.onsite ? ['ONSITE'] : []),
    ]
    const url = edit ? `/api/admin/staff/${edit.id}` : '/api/admin/staff'
    const method = edit ? 'PATCH' : 'POST'
    const body = edit
      ? { name: form.name, role: form.role, channel_access }
      : { email: form.email, name: form.name, role: form.role, channel_access }
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    setSaving(false)
    if (r.ok) {
      setMsg('สำเร็จ')
      setTimeout(() => { setShowForm(false); load() }, 600)
    } else {
      setMsg(d.error || 'เกิดข้อผิดพลาด')
    }
  }

  async function toggle(s: Staff) {
    await fetch(`/api/admin/staff/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    })
    load()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="admin-h1">พนักงาน</h1>
          <p className="admin-sub">{list.length} คน · เฉพาะ SUPER_ADMIN จัดการได้</p>
        </div>
        <button onClick={openCreate} className="admin-btn admin-btn-ink">
          <Plus size={14} /> เพิ่มพนักงาน
        </button>
      </div>

      <div className="admin-card" style={{ overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>Email</th>
              <th>Role</th>
              <th>Channel</th>
              <th>วันสร้าง</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-mute)' }}>กำลังโหลด...</td></tr>
            ) : list.map(s => (
              <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.5 }}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td className="muted">{s.email}</td>
                <td><span className={ROLE_PILL[s.role] || 'admin-pill'}>{s.role}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {s.channel_access.map(c => (
                      <span key={c} className="admin-pill">{c}</span>
                    ))}
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 11 }}>{formatDate(s.created_at)}</td>
                <td>
                  <span className={s.is_active ? 'admin-pill admin-pill-green' : 'admin-pill'}>
                    {s.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(s)} className="admin-btn admin-btn-ghost" style={{ padding: '4px 8px' }}>
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => toggle(s)} className="admin-btn admin-btn-ghost" style={{ padding: '4px 8px' }}>
                      {s.is_active ? <ToggleRight size={14} color="var(--green)" /> : <ToggleLeft size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(14,14,14,0.45)',
          backdropFilter: 'blur(4px)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 460, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="admin-h1" style={{ fontSize: 18 }}>{edit ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--ink-mute)" />
              </button>
            </div>

            {!edit && (
              <p style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 14, padding: '10px 12px', background: 'var(--bg-soft)', borderRadius: 'var(--r-md)' }}>
                ⚠️ พนักงานต้อง register/login ระบบก่อน แล้วใส่ email ที่ใช้
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', display: 'block', marginBottom: 4 }}>
                  Email {!edit && '*'}
                </label>
                <input className="admin-field" type="email" value={form.email}
                  disabled={!!edit}
                  onChange={e => setForm(s => ({...s, email: e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', display: 'block', marginBottom: 4 }}>ชื่อ *</label>
                <input className="admin-field" type="text" value={form.name}
                  onChange={e => setForm(s => ({...s, name: e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', display: 'block', marginBottom: 4 }}>Role *</label>
                <select className="admin-field" value={form.role}
                  onChange={e => setForm(s => ({...s, role: e.target.value}))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', display: 'block', marginBottom: 6 }}>Channel access</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 14px', background: form.online ? 'var(--ink)' : 'var(--bg-soft)', color: form.online ? '#fff' : 'var(--ink)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input type="checkbox" checked={form.online} onChange={e => setForm(s => ({...s, online: e.target.checked}))} style={{ display: 'none' }} />
                    Online
                  </label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 14px', background: form.onsite ? 'var(--ink)' : 'var(--bg-soft)', color: form.onsite ? '#fff' : 'var(--ink)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input type="checkbox" checked={form.onsite} onChange={e => setForm(s => ({...s, onsite: e.target.checked}))} style={{ display: 'none' }} />
                    Onsite
                  </label>
                </div>
              </div>
            </div>

            {msg && <p style={{ fontSize: 12, marginTop: 12, color: msg === 'สำเร็จ' ? 'var(--green)' : 'var(--red)' }}>{msg}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} className="admin-btn admin-btn-ghost" style={{ flex: 1 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving || !form.name || (!edit && !form.email)} className="admin-btn admin-btn-ink" style={{ flex: 2 }}>
                {saving ? 'กำลังบันทึก...' : (edit ? 'อัพเดต' : 'เพิ่ม')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
