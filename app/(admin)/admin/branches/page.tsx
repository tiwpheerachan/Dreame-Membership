'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Plus, X, Edit3, Trash2, Image as ImageIcon, MapPin, Eye, EyeOff,
  Loader2, Search, Store, Home, RefreshCw, Save, Phone, Clock, ExternalLink,
} from 'lucide-react'
import type { Branch } from '@/types'
import { formatDate } from '@/lib/utils'
import Drawer from '@/components/admin/Drawer'

type FormState = {
  id?: string
  name: string
  address: string
  map_url: string
  phone: string
  hours: string
  badge_text: string
  sort_order: string
  is_active: boolean
  show_on_home: boolean
  image_url: string
  image?: File | null
  gallery: string[]         // existing gallery URLs to keep
  galleryFiles: File[]      // newly-added files to upload
}

const empty: FormState = {
  name: '', address: '', map_url: '', phone: '', hours: '', badge_text: '',
  sort_order: '0', is_active: true, show_on_home: true,
  image_url: '', image: null,
  gallery: [], galleryFiles: [],
}

type StatusFilter = 'all' | 'active' | 'inactive'

export default function AdminBranchesPage() {
  const [items, setItems] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [q, setQ] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/branches')
      const data = await res.json()
      setItems(data.branches || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => ({
    all:      items.length,
    active:   items.filter(b => b.is_active).length,
    inactive: items.filter(b => !b.is_active).length,
    on_home:  items.filter(b => b.show_on_home).length,
  }), [items])

  const filtered = useMemo(() => {
    let list = items
    if (statusFilter === 'active')   list = list.filter(b => b.is_active)
    if (statusFilter === 'inactive') list = list.filter(b => !b.is_active)
    if (q) {
      const s = q.toLowerCase()
      list = list.filter(b =>
        (b.name || '').toLowerCase().includes(s) ||
        (b.address || '').toLowerCase().includes(s) ||
        (b.badge_text || '').toLowerCase().includes(s),
      )
    }
    return list
  }, [items, statusFilter, q])

  function openCreate() { setEditing({ ...empty }) }

  function openEdit(b: Branch) {
    setEditing({
      id: b.id,
      name: b.name || '',
      address: b.address || '',
      map_url: b.map_url || '',
      phone: b.phone || '',
      hours: b.hours || '',
      badge_text: b.badge_text || '',
      sort_order: String(b.sort_order ?? 0),
      is_active: b.is_active,
      show_on_home: b.show_on_home ?? true,
      image_url: b.image_url || '',
      image: null,
      gallery: b.gallery_urls || [],
      galleryFiles: [],
    })
  }

  async function toggleActive(b: Branch) {
    setItems(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x))
    await fetch(`/api/admin/branches/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !b.is_active }),
    })
  }

  async function remove(id: string) {
    if (!confirm('ยืนยันการลบสาขานี้?')) return
    const res = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(x => x.id !== id))
  }

  function manualRefresh() {
    setRefreshing(true)
    load().finally(() => setTimeout(() => setRefreshing(false), 400))
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p style={{ color: 'var(--admin-gold)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
              Marketing
            </p>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--admin-ink)' }}>สาขาของเรา</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
              {items.length} สาขา · {counts.active} เปิดใช้ · {counts.on_home} แสดงในหน้า home
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={manualRefresh} disabled={refreshing} className="admin-btn admin-btn-ghost">
              {refreshing ? <Loader2 size={12} className="spinner" /> : <RefreshCw size={12} />}
              รีเฟรช
            </button>
            <button onClick={openCreate} className="admin-btn admin-btn-ink">
              <Plus size={13} /> เพิ่มสาขา
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5">

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { lbl: 'ทั้งหมด',     val: counts.all },
          { lbl: 'เปิดใช้',     val: counts.active,   color: 'var(--green)' },
          { lbl: 'แสดงใน home', val: counts.on_home,  color: 'var(--gold-deep)' },
          { lbl: 'ปิดใช้',      val: counts.inactive, color: 'var(--ink-mute)' },
        ].map(s => (
          <div key={s.lbl} className="admin-card" style={{ padding: 14 }}>
            <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              {s.lbl}
            </p>
            <p className="num" style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: s.color || 'var(--ink)' }}>
              {s.val.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {([
          { key: 'all',      label: 'ทั้งหมด', count: counts.all },
          { key: 'active',   label: 'เปิดใช้', count: counts.active },
          { key: 'inactive', label: 'ปิดใช้',  count: counts.inactive },
        ] as Array<{ key: StatusFilter; label: string; count: number }>).map(c => {
          const active = statusFilter === c.key
          return (
            <button key={c.key} onClick={() => setStatusFilter(c.key)}
              className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}>
              {c.label}
              <span style={{
                fontSize: 10.5, padding: '1px 7px', borderRadius: 100,
                background: active ? 'rgba(255,255,255,0.18)' : 'var(--bg-soft)',
                color: active ? '#fff' : 'var(--ink-mute)', fontWeight: 700,
              }}>{c.count}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
        <input className="admin-field" placeholder="ค้นหาชื่อสาขา ที่อยู่ หรือ badge..."
          value={q} onChange={e => setQ(e.target.value)}
          style={{ paddingLeft: 36, fontSize: 12.5 }} />
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="admin-card" style={{ padding: 60, textAlign: 'center', color: 'var(--ink-mute)' }}>
          <Loader2 size={24} className="spinner" style={{ margin: '0 auto 8px', display: 'block' }} />
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-card" style={{ padding: 60, textAlign: 'center', color: 'var(--ink-mute)' }}>
          <Store size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--ink-faint)' }} />
          <p style={{ margin: 0, fontSize: 13 }}>
            {items.length === 0 ? 'ยังไม่มีสาขา — กดเพิ่มสาขาเพื่อเริ่ม' : 'ไม่พบสาขาที่ตรงกัน'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12,
        }}>
          {filtered.map(b => (
            <BranchAdminCard
              key={b.id}
              branch={b}
              onEdit={() => openEdit(b)}
              onToggle={() => toggleActive(b)}
              onDelete={() => remove(b.id)}
            />
          ))}
        </div>
      )}

      {/* Edit drawer */}
      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}
        subtitle={editing?.id ? `${editing?.name || '(ไม่มีชื่อ)'}` : 'แสดงในหน้า home และ /branches'}
        width={620}
      >
        {editing && (
          <BranchForm
            value={editing}
            onChange={setEditing}
            onClose={() => setEditing(null)}
            onSaved={(b) => {
              setItems(prev => {
                const i = prev.findIndex(x => x.id === b.id)
                if (i >= 0) { const next = [...prev]; next[i] = b; return next }
                return [b, ...prev]
              })
              setEditing(null)
            }}
          />
        )}
      </Drawer>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Card with image preview + actions
// ────────────────────────────────────────────────────────────────

function BranchAdminCard({
  branch, onEdit, onToggle, onDelete,
}: {
  branch: Branch
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="admin-card" style={{
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: '#fff', transition: 'box-shadow 0.15s, border-color 0.15s',
    }}>
      <div
        onClick={onEdit}
        style={{
          position: 'relative', cursor: 'pointer',
          aspectRatio: '16/10',
          background: branch.image_url ? '#000' : 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
        }}
      >
        {branch.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branch.image_url} alt={branch.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold-deep)',
          }}>
            <Store size={28} strokeWidth={1.4} />
          </div>
        )}

        {/* Top-right: branch name tag (as requested) */}
        <span style={{
          position: 'absolute', top: 6, right: 6,
          padding: '3px 9px', borderRadius: 'var(--r-pill)',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          color: '#fff', fontSize: 9.5, fontWeight: 700,
          maxWidth: 'calc(100% - 12px)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <MapPin size={9} /> {branch.name}
        </span>

        {/* Top-left: status + badge */}
        <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 3 }}>
          {branch.show_on_home && (
            <span title="แสดงในหน้า home" style={{
              padding: 4, borderRadius: 5,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
              color: 'var(--gold-soft)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Home size={9} />
            </span>
          )}
          <span style={{
            padding: '2px 6px', borderRadius: 'var(--r-pill)',
            background: branch.is_active ? 'rgba(46,122,61,0.85)' : 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            color: '#fff', fontSize: 8.5, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            {branch.is_active ? '●' : '○'}
          </span>
        </div>

        {branch.badge_text && (
          <span style={{
            position: 'absolute', bottom: 6, left: 6,
            padding: '3px 8px', borderRadius: 'var(--r-pill)',
            background: 'linear-gradient(135deg,#EADBB1,#A0782B)',
            color: '#1a1815', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}>
            {branch.badge_text}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 12.5, lineHeight: 1.3 }}>
          {branch.name || <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>(ไม่มีชื่อ)</span>}
        </p>
        {branch.address && (
          <p style={{
            margin: 0, fontSize: 10.5, color: 'var(--ink-mute)', lineHeight: 1.45,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
          }}>
            {branch.address}
          </p>
        )}
        {branch.hours && (
          <p style={{ margin: 0, fontSize: 10, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /> {branch.hours}
          </p>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--hair)', gap: 4,
        }}>
          <div style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            #{branch.sort_order} · {formatDate(branch.created_at || '')}
          </div>
          <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <IconBtn title="แก้ไข" onClick={onEdit}><Edit3 size={11} /></IconBtn>
            <IconBtn title={branch.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} onClick={onToggle}>
              {branch.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
            </IconBtn>
            {branch.map_url && (
              <a href={branch.map_url} target="_blank" rel="noopener noreferrer"
                title="เปิด Google Maps" className="admin-btn admin-btn-ghost"
                style={{ padding: 4, fontSize: 10 }}>
                <ExternalLink size={11} />
              </a>
            )}
            <IconBtn title="ลบ" onClick={onDelete} danger><Trash2 size={11} /></IconBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconBtn({
  children, onClick, title, danger,
}: {
  children: React.ReactNode; onClick: () => void; title: string; danger?: boolean
}) {
  return (
    <button onClick={onClick} title={title}
      className="admin-btn admin-btn-ghost"
      style={{
        padding: 4, fontSize: 10,
        color: danger ? 'var(--red)' : 'var(--ink-mute)',
        borderColor: danger ? 'rgba(139,58,58,0.18)' : undefined,
      }}>
      {children}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────
// Form (drawer content)
// ────────────────────────────────────────────────────────────────

function BranchForm({
  value, onChange, onClose, onSaved,
}: {
  value: FormState
  onChange: (v: FormState) => void
  onClose: () => void
  onSaved: (b: Branch) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(value.image_url || null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    onChange({ ...value, image: f })
    setPreviewUrl(URL.createObjectURL(f))
  }

  function clearImage() {
    onChange({ ...value, image: null, image_url: '' })
    setPreviewUrl(null)
  }

  function pickGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    onChange({ ...value, galleryFiles: [...value.galleryFiles, ...files] })
    e.target.value = ''  // allow re-selecting the same file
  }

  function removeGalleryUrl(url: string) {
    onChange({ ...value, gallery: value.gallery.filter(u => u !== url) })
  }

  function removeGalleryFile(idx: number) {
    onChange({ ...value, galleryFiles: value.galleryFiles.filter((_, i) => i !== idx) })
  }

  async function save() {
    setSaving(true); setMsg('')
    const fd = new FormData()
    fd.append('name', value.name)
    fd.append('address', value.address)
    fd.append('map_url', value.map_url)
    fd.append('phone', value.phone)
    fd.append('hours', value.hours)
    fd.append('badge_text', value.badge_text)
    fd.append('sort_order', value.sort_order)
    fd.append('is_active', String(value.is_active))
    fd.append('show_on_home', String(value.show_on_home))
    if (value.image) fd.append('image', value.image)
    else if (value.image_url) fd.append('image_url', value.image_url)
    // Gallery: send kept URLs as JSON + append each new file under 'gallery'.
    fd.append('gallery_urls', JSON.stringify(value.gallery))
    value.galleryFiles.forEach(f => fd.append('gallery', f))

    const url = value.id ? `/api/admin/branches/${value.id}` : '/api/admin/branches'
    const method = value.id ? 'PATCH' : 'POST'
    try {
      const res = await fetch(url, { method, body: fd })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'เกิดข้อผิดพลาด'); return }
      onSaved(data.branch)
    } catch {
      setMsg('เชื่อมต่อไม่ได้')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Image upload */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          รูปสาขา
        </p>
        {previewUrl ? (
          <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#000' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="preview"
              style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block', background: '#000' }} />
            <button onClick={clearImage}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <X size={14} color="#fff" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', padding: '32px 16px',
              border: '2px dashed var(--hair)', borderRadius: 'var(--r-md)',
              background: 'var(--bg-soft)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              color: 'var(--ink-mute)', fontFamily: 'inherit',
            }}>
            <ImageIcon size={22} strokeWidth={1.5} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>คลิกเพื่อเลือกรูปสาขา</span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>JPG / PNG / WEBP</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} />
      </div>

      {/* Gallery — multiple photos shown on /branches */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 4px' }}>
          แกลเลอรีรูปสาขา
        </p>
        <p style={{ fontSize: 10.5, color: 'var(--ink-faint)', margin: '0 0 10px' }}>
          รูปเพิ่มเติมที่ลูกค้ากดดูได้ในหน้ารวมสาขา (เลือกได้หลายรูป)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 8 }}>
          {value.gallery.map(url => (
            <GalleryThumb key={url} src={url} onRemove={() => removeGalleryUrl(url)} />
          ))}
          {value.galleryFiles.map((f, i) => (
            <GalleryThumb key={`new-${i}`} src={URL.createObjectURL(f)} isNew onRemove={() => removeGalleryFile(i)} />
          ))}
          <button onClick={() => galleryRef.current?.click()}
            style={{
              aspectRatio: '1', borderRadius: 'var(--r-md)',
              border: '2px dashed var(--hair)', background: 'var(--bg-soft)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              color: 'var(--ink-mute)', fontFamily: 'inherit',
            }}>
            <Plus size={16} />
            <span style={{ fontSize: 9.5, fontWeight: 600 }}>เพิ่มรูป</span>
          </button>
        </div>
        <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={pickGallery} />
      </div>

      {/* Basic info */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          ข้อมูลสาขา
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldGroup label="ชื่อสาขา * (แสดงเป็นป้ายมุมขวาบน)">
            <input className="admin-field" type="text" value={value.name}
              onChange={e => onChange({ ...value, name: e.target.value })}
              placeholder="เช่น สาขาเซ็นทรัลเวิลด์"
              style={{ width: '100%', fontSize: 12.5 }} />
          </FieldGroup>
          <FieldGroup label="ที่อยู่">
            <textarea className="admin-field" rows={2} value={value.address}
              onChange={e => onChange({ ...value, address: e.target.value })}
              placeholder="เลขที่ ถนน แขวง เขต จังหวัด"
              style={{ width: '100%', fontSize: 12.5, resize: 'vertical' }} />
          </FieldGroup>
          <FieldGroup label="Google Maps URL (ปุ่ม “นำทาง”)">
            <input className="admin-field" type="url" value={value.map_url}
              onChange={e => onChange({ ...value, map_url: e.target.value })}
              placeholder="https://maps.app.goo.gl/..."
              style={{ width: '100%', fontSize: 12.5 }} />
          </FieldGroup>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FieldGroup label="เบอร์โทร">
              <input className="admin-field" type="tel" value={value.phone}
                onChange={e => onChange({ ...value, phone: e.target.value })}
                placeholder="02-xxx-xxxx" style={{ width: '100%', fontSize: 12.5 }} />
            </FieldGroup>
            <FieldGroup label="เวลาเปิด-ปิด">
              <input className="admin-field" type="text" value={value.hours}
                onChange={e => onChange({ ...value, hours: e.target.value })}
                placeholder="10:00 – 22:00 ทุกวัน" style={{ width: '100%', fontSize: 12.5 }} />
            </FieldGroup>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FieldGroup label="Badge (ป้ายไฮไลต์)">
              <input className="admin-field" type="text" value={value.badge_text}
                onChange={e => onChange({ ...value, badge_text: e.target.value })}
                placeholder="เปิดใหม่" style={{ width: '100%', fontSize: 12.5 }} />
            </FieldGroup>
            <FieldGroup label="ลำดับ (มากกว่า = บนกว่า)">
              <input className="admin-field" type="number" value={value.sort_order}
                onChange={e => onChange({ ...value, sort_order: e.target.value })}
                style={{ width: '100%', fontSize: 12.5 }} />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          การแสดงผล
        </p>
        <ToggleRow
          label="เปิดใช้งาน"
          subtitle="ถ้าปิด จะไม่แสดงทั้งใน home และ /branches"
          checked={value.is_active}
          onChange={v => onChange({ ...value, is_active: v })}
        />
        <ToggleRow
          label="แสดงในหน้า home"
          subtitle="ถ้าปิด จะแสดงเฉพาะหน้ารวมสาขา /branches เท่านั้น"
          checked={value.show_on_home}
          onChange={v => onChange({ ...value, show_on_home: v })}
        />
      </div>

      {msg && (
        <p style={{
          margin: 0, padding: '8px 12px', borderRadius: 'var(--r-md)',
          background: 'var(--red-soft)', color: 'var(--red)',
          fontSize: 12, fontWeight: 600,
        }}>
          ⚠️ {msg}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: -18, padding: '12px 0 4px', background: '#fff' }}>
        <button onClick={onClose} className="admin-btn admin-btn-ghost"
          style={{ flex: 1, padding: '10px', fontSize: 13 }}>
          ยกเลิก
        </button>
        <button onClick={save} disabled={saving || !value.name}
          className="admin-btn admin-btn-ink"
          style={{ flex: 2, padding: '10px', fontSize: 13, gap: 6 }}>
          {saving ? <Loader2 size={13} className="spinner" /> : <Save size={13} />}
          {value.id ? 'อัพเดต' : 'เพิ่มสาขา'}
        </button>
      </div>
    </div>
  )
}

function GalleryThumb({ src, onRemove, isNew }: { src: string; onRemove: () => void; isNew?: boolean }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#000' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="gallery" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <button onClick={onRemove} title="ลบรูป"
        style={{
          position: 'absolute', top: 4, right: 4,
          width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        <X size={11} color="#fff" />
      </button>
      {isNew && (
        <span style={{
          position: 'absolute', bottom: 4, left: 4,
          padding: '1px 5px', borderRadius: 'var(--r-pill)',
          background: 'var(--gold-deep)', color: '#fff',
          fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>ใหม่</span>
      )}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function ToggleRow({
  label, subtitle, checked, onChange,
}: {
  label: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
      borderBottom: '1px solid var(--hair)', cursor: 'pointer',
    }}>
      <input type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: 'var(--ink)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-mute)' }}>{subtitle}</p>
      </div>
    </label>
  )
}
