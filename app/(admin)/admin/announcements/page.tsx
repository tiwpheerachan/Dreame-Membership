'use client'
import { useEffect, useState, useRef } from 'react'
import { Plus, X, Edit2, Trash2, Bell, Image as ImageIcon, Eye, EyeOff } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface A {
  id: string; title: string; body?: string; image_url?: string; link_url?: string;
  badge_text?: string; audience: 'ALL' | 'TIER' | 'SEGMENT'; audience_tier?: string;
  is_active: boolean; starts_at?: string; ends_at?: string; created_at: string;
}

const empty = {
  title: '', body: '', link_url: '', badge_text: '',
  audience: 'ALL' as const, audience_tier: '',
  is_active: true, starts_at: '', ends_at: '',
  image_url: '', image: null as File | null,
}

export default function AnnouncementsPage() {
  const [list, setList] = useState<A[]>([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [edit, setEdit] = useState<A | null>(null)
  const [form, setForm] = useState({ ...empty })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/announcements')
    const d = await r.json()
    if (r.ok) setList(d.announcements || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEdit(null); setForm({ ...empty }); setPreviewUrl(null); setShow(true); setMsg('')
  }
  function openEdit(a: A) {
    setEdit(a)
    setForm({
      title: a.title || '', body: a.body || '',
      link_url: a.link_url || '', badge_text: a.badge_text || '',
      audience: a.audience, audience_tier: a.audience_tier || '',
      is_active: a.is_active,
      starts_at: a.starts_at || '', ends_at: a.ends_at || '',
      image_url: a.image_url || '', image: null,
    })
    setPreviewUrl(a.image_url || null)
    setShow(true); setMsg('')
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setForm(s => ({ ...s, image: f }))
    setPreviewUrl(URL.createObjectURL(f))
  }

  async function save() {
    setSaving(true); setMsg('')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'image' && v instanceof File) fd.append('image', v)
      else if (k !== 'image' && v !== '' && v != null) fd.append(k, String(v))
    })
    const url = edit ? `/api/admin/announcements/${edit.id}` : '/api/admin/announcements'
    const method = edit ? 'PATCH' : 'POST'

    let r: Response
    if (edit) {
      // PATCH supports JSON only — convert form to JSON
      const json: Record<string, unknown> = {}
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'image') return
        if (v !== '' && v != null) json[k] = v
      })
      r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) })
    } else {
      r = await fetch(url, { method, body: fd })
    }
    const d = await r.json()
    setSaving(false)
    if (r.ok) { setMsg('สำเร็จ'); setTimeout(() => { setShow(false); load() }, 600) }
    else setMsg(d.error || 'ไม่สำเร็จ')
  }

  async function toggle(a: A) {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !a.is_active }),
    })
    load()
  }
  async function remove(id: string) {
    if (!confirm('ลบประกาศนี้?')) return
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="admin-h1"><Bell size={18} style={{ verticalAlign: 'baseline' }} /> ประกาศ</h1>
          <p className="admin-sub">{list.length} announcements</p>
        </div>
        <button onClick={openCreate} className="admin-btn admin-btn-ink"><Plus size={14} /> สร้างประกาศ</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {loading ? <p style={{ color: 'var(--ink-mute)', fontSize: 13 }}>กำลังโหลด...</p>
        : list.length === 0 ? <p style={{ color: 'var(--ink-mute)', fontSize: 13 }}>ยังไม่มีประกาศ</p>
        : list.map(a => (
          <div key={a.id} className="admin-card" style={{ overflow: 'hidden' }}>
            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image_url} alt="" style={{ width: '100%', height: 130, objectFit: 'cover' }} />
            )}
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>{a.title}</p>
                <span className={a.is_active ? 'admin-pill admin-pill-green' : 'admin-pill'}>
                  {a.is_active ? 'Active' : 'Off'}
                </span>
              </div>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--ink-mute)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                {a.body || '—'}
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--ink-faint)' }}>
                {a.audience}{a.audience_tier ? ` · ${a.audience_tier}` : ''} · created {formatDate(a.created_at)}
              </p>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => openEdit(a)} className="admin-btn admin-btn-ghost" style={{ padding: '4px 8px' }}><Edit2 size={11} /></button>
                <button onClick={() => toggle(a)} className="admin-btn admin-btn-ghost" style={{ padding: '4px 8px' }}>
                  {a.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button onClick={() => remove(a.id)} className="admin-btn admin-btn-danger" style={{ padding: '4px 8px', marginLeft: 'auto' }}><Trash2 size={11} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      {show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 520, padding: 24, marginTop: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="admin-h1" style={{ fontSize: 18 }}>{edit ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่'}</h2>
              <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="var(--ink-mute)" /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!edit && (
                <div>
                  {previewUrl ? (
                    <div style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--r-md)' }} />
                      <button onClick={() => { setForm(s => ({ ...s, image: null })); setPreviewUrl(null) }}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}>×</button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="admin-btn admin-btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '20px' }}>
                      <ImageIcon size={14} /> เลือกรูป
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
                </div>
              )}
              <input className="admin-field" placeholder="ชื่อประกาศ *" value={form.title}
                onChange={e => setForm(s => ({ ...s, title: e.target.value }))} />
              <textarea className="admin-field" rows={3} placeholder="รายละเอียด..." value={form.body}
                onChange={e => setForm(s => ({ ...s, body: e.target.value }))} style={{ resize: 'none' }} />
              <input className="admin-field" placeholder="Link URL" value={form.link_url}
                onChange={e => setForm(s => ({ ...s, link_url: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="admin-field" placeholder="Badge text" value={form.badge_text}
                  onChange={e => setForm(s => ({ ...s, badge_text: e.target.value }))} style={{ flex: 1 }} />
                <select className="admin-field" value={form.audience}
                  onChange={e => setForm(s => ({ ...s, audience: e.target.value as 'ALL' | 'TIER' | 'SEGMENT' }))} style={{ flex: 1 }}>
                  <option value="ALL">All members</option>
                  <option value="TIER">Tier specific</option>
                  <option value="SEGMENT">Segment</option>
                </select>
              </div>
              {form.audience === 'TIER' && (
                <select className="admin-field" value={form.audience_tier}
                  onChange={e => setForm(s => ({ ...s, audience_tier: e.target.value }))}>
                  <option value="">เลือก tier</option>
                  <option value="PLUS">Plus</option>
                  <option value="PRO">Pro</option>
                  <option value="ULTRA">Ultra</option>
                  <option value="MASTER">Master</option>
                </select>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="admin-field" type="datetime-local" placeholder="Starts" value={form.starts_at?.slice(0, 16)}
                  onChange={e => setForm(s => ({ ...s, starts_at: e.target.value }))} style={{ flex: 1 }} />
                <input className="admin-field" type="datetime-local" placeholder="Ends" value={form.ends_at?.slice(0, 16)}
                  onChange={e => setForm(s => ({ ...s, ends_at: e.target.value }))} style={{ flex: 1 }} />
              </div>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--ink-mute)' }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(s => ({ ...s, is_active: e.target.checked }))} />
                เปิดใช้งาน
              </label>
            </div>

            {msg && <p style={{ fontSize: 12, marginTop: 12, color: msg.includes('สำเร็จ') ? 'var(--green)' : 'var(--red)' }}>{msg}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShow(false)} className="admin-btn admin-btn-ghost" style={{ flex: 1 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving || !form.title} className="admin-btn admin-btn-ink" style={{ flex: 2 }}>
                {saving ? '...' : (edit ? 'อัพเดต' : 'สร้าง')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
