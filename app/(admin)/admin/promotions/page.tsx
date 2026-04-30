'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Plus, X, Edit3, Trash2, Image as ImageIcon, ExternalLink, Eye, EyeOff,
  Loader2, Search, Sparkles, Layout, Home, RefreshCw, Save,
} from 'lucide-react'
import type { Promotion } from '@/types'
import { formatDate } from '@/lib/utils'
import Drawer from '@/components/admin/Drawer'

type LayoutValue = 'hero' | 'card' | 'feed' | 'banner'

const LAYOUTS: Array<{ value: LayoutValue; label: string; description: string }> = [
  { value: 'banner', label: 'Banner', description: 'แบนเนอร์บนสุดเลื่อนอัตโนมัติ — รองรับวิดีโอ' },
  { value: 'hero',   label: 'Hero',   description: 'การ์ดเด่นในหน้า home (รูป + ราคา)' },
  { value: 'card',   label: 'Card',   description: 'การ์ดเล็กในแถว carousel' },
  { value: 'feed',   label: 'Feed',   description: 'การ์ดแนวตั้งในหน้า /promotions' },
]

const LAYOUT_LABEL: Record<string, string> = {
  banner: 'Banner', hero: 'Hero', card: 'Card', feed: 'Feed',
}

type FormState = {
  id?: string
  title: string
  description: string
  link_url: string
  original_price: string
  discounted_price: string
  discount_label: string
  badge_text: string
  sort_order: string
  layout: LayoutValue
  banner_row: 1 | 2
  is_active: boolean
  show_on_home: boolean
  image_url: string
  video_url: string
  image?: File | null
}

const empty: FormState = {
  title: '', description: '', link_url: '',
  original_price: '', discounted_price: '',
  discount_label: '', badge_text: '',
  sort_order: '0', layout: 'card',
  banner_row: 1,
  is_active: true, show_on_home: true,
  image_url: '', video_url: '', image: null,
}

type StatusFilter = 'all' | 'active' | 'inactive'
type LayoutFilter = 'all' | 'hero' | 'card' | 'feed' | 'banner'

export default function AdminPromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [layoutFilter, setLayoutFilter] = useState<LayoutFilter>('all')
  const [q, setQ] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/promotions')
      const data = await res.json()
      setItems(data.promotions || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => ({
    all:      items.length,
    active:   items.filter(p => p.is_active).length,
    inactive: items.filter(p => !p.is_active).length,
    banner:   items.filter(p => p.layout === 'banner').length,
    hero:     items.filter(p => p.layout === 'hero').length,
    card:     items.filter(p => p.layout === 'card').length,
    feed:     items.filter(p => p.layout === 'feed').length,
    on_home:  items.filter(p => p.show_on_home).length,
  }), [items])

  const filtered = useMemo(() => {
    let list = items
    if (statusFilter === 'active')   list = list.filter(p => p.is_active)
    if (statusFilter === 'inactive') list = list.filter(p => !p.is_active)
    if (layoutFilter !== 'all')      list = list.filter(p => p.layout === layoutFilter)
    if (q) {
      const s = q.toLowerCase()
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(s) ||
        (p.description || '').toLowerCase().includes(s) ||
        (p.badge_text || '').toLowerCase().includes(s),
      )
    }
    return list
  }, [items, statusFilter, layoutFilter, q])

  function openCreate() {
    setEditing({ ...empty })
  }

  function openEdit(p: Promotion) {
    setEditing({
      id: p.id,
      title: p.title || '',
      description: p.description || '',
      link_url: p.link_url || '',
      original_price: p.original_price?.toString() || '',
      discounted_price: p.discounted_price?.toString() || '',
      discount_label: p.discount_label || '',
      badge_text: p.badge_text || '',
      sort_order: String(p.sort_order ?? 0),
      layout: p.layout,
      banner_row: (p.banner_row === 2 ? 2 : 1),
      is_active: p.is_active,
      show_on_home: p.show_on_home ?? true,
      image_url: p.image_url || '',
      video_url: p.video_url || '',
      image: null,
    })
  }

  async function toggleActive(p: Promotion) {
    setItems(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x))
    await fetch(`/api/admin/promotions/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    })
  }

  async function remove(id: string) {
    if (!confirm('ยืนยันการลบโปรโมชั่นนี้?')) return
    const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => prev.filter(x => x.id !== id))
    }
  }

  function manualRefresh() {
    setRefreshing(true)
    load().finally(() => setTimeout(() => setRefreshing(false), 400))
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="admin-h1">โปรโมชั่น & โฆษณา</h1>
          <p className="admin-sub">{items.length} รายการ · {counts.active} เปิดใช้ · {counts.on_home} แสดงในหน้า home</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={manualRefresh} disabled={refreshing}
            className="admin-btn admin-btn-ghost" style={{ padding: '7px 12px', fontSize: 12, gap: 6 }}>
            {refreshing ? <Loader2 size={12} className="spinner" /> : <RefreshCw size={12} />}
            รีเฟรช
          </button>
          <button onClick={openCreate} className="admin-btn admin-btn-ink"
            style={{ padding: '8px 14px', fontSize: 12.5, gap: 6 }}>
            <Plus size={13} /> สร้างโปรโมชั่น
          </button>
        </div>
      </div>

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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
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

      {/* Layout chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {([
          { key: 'all',    label: 'ทุกรูปแบบ', count: counts.all },
          { key: 'banner', label: 'Banner',   count: counts.banner },
          { key: 'hero',   label: 'Hero',     count: counts.hero },
          { key: 'card',   label: 'Card',     count: counts.card },
          { key: 'feed',   label: 'Feed',     count: counts.feed },
        ] as Array<{ key: LayoutFilter; label: string; count: number }>).map(c => {
          const active = layoutFilter === c.key
          return (
            <button key={c.key} onClick={() => setLayoutFilter(c.key)}
              className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
              style={{ padding: '5px 10px', fontSize: 11.5, gap: 5 }}>
              {c.label}
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 100,
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
        <input className="admin-field" placeholder="ค้นหาชื่อ คำอธิบาย หรือ badge..."
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
          <Sparkles size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--ink-faint)' }} />
          <p style={{ margin: 0, fontSize: 13 }}>
            {items.length === 0 ? 'ยังไม่มีโปรโมชั่น — กดสร้างใหม่เพื่อเริ่ม' : 'ไม่พบโปรโมชั่นที่ตรงกัน'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14,
        }}>
          {filtered.map(p => (
            <PromoAdminCard
              key={p.id}
              promo={p}
              onEdit={() => openEdit(p)}
              onToggle={() => toggleActive(p)}
              onDelete={() => remove(p.id)}
            />
          ))}
        </div>
      )}

      {/* Edit drawer */}
      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่นใหม่'}
        subtitle={editing?.id ? `${editing?.title || '(ไม่มีชื่อ)'}` : 'แสดงในหน้า home และ /promotions'}
        width={620}
      >
        {editing && (
          <PromoForm
            value={editing}
            onChange={setEditing}
            onClose={() => setEditing(null)}
            onSaved={(p) => {
              setItems(prev => {
                const i = prev.findIndex(x => x.id === p.id)
                if (i >= 0) {
                  const next = [...prev]
                  next[i] = p
                  return next
                }
                return [p, ...prev]
              })
              setEditing(null)
            }}
          />
        )}
      </Drawer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Card with image preview + actions
// ────────────────────────────────────────────────────────────────

function PromoAdminCard({
  promo, onEdit, onToggle, onDelete,
}: {
  promo: Promotion
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="admin-card" style={{
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: '#fff', transition: 'box-shadow 0.15s, border-color 0.15s',
    }}>
      {/* Preview media with overlay status */}
      <div
        onClick={onEdit}
        style={{
          position: 'relative', cursor: 'pointer',
          aspectRatio:
            promo.layout === 'banner' ? '12/5' :
            promo.layout === 'feed'   ? '4/5'  :
            '16/10',
          background: (promo.image_url || promo.video_url) ? '#000' : 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
        }}
      >
        {promo.video_url ? (
          <video src={promo.video_url}
            muted loop playsInline preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : promo.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.image_url} alt={promo.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold-deep)',
          }}>
            <ImageIcon size={28} strokeWidth={1.4} />
          </div>
        )}

        {/* Top-left: layout badge */}
        <span style={{
          position: 'absolute', top: 10, left: 10,
          padding: '3px 9px', borderRadius: 'var(--r-pill)',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Layout size={9} /> {LAYOUT_LABEL[promo.layout]}
        </span>

        {/* Top-right: status indicators */}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
          {promo.show_on_home && (
            <span title="แสดงในหน้า home" style={{
              padding: 5, borderRadius: 6,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
              color: 'var(--gold-soft)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Home size={11} />
            </span>
          )}
          <span style={{
            padding: '3px 8px', borderRadius: 'var(--r-pill)',
            background: promo.is_active ? 'rgba(46,122,61,0.85)' : 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            color: '#fff', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {promo.is_active ? '● ACTIVE' : '○ OFF'}
          </span>
        </div>

        {/* Custom badge */}
        {promo.badge_text && (
          <span style={{
            position: 'absolute', bottom: 10, left: 10,
            padding: '4px 11px', borderRadius: 'var(--r-pill)',
            background: 'linear-gradient(135deg,#EADBB1,#A0782B)',
            color: '#1a1815', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          }}>
            {promo.badge_text}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div>
          <p style={{
            margin: 0, fontWeight: 700, fontSize: 13.5, lineHeight: 1.35,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
          }}>
            {promo.title || <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>(ไม่มีชื่อ)</span>}
          </p>
          {promo.description && (
            <p style={{
              margin: '4px 0 0', fontSize: 11.5, color: 'var(--ink-mute)', lineHeight: 1.5,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
            }}>
              {promo.description}
            </p>
          )}
        </div>

        {/* Pricing strip */}
        {(promo.original_price || promo.discounted_price) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            {promo.original_price ? (
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>
                ฿{Number(promo.original_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discounted_price ? (
              <span className="num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold-deep)' }}>
                ฿{Number(promo.discounted_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discount_label && (
              <span className="admin-pill admin-pill-amber" style={{ fontSize: 10 }}>
                {promo.discount_label}
              </span>
            )}
          </div>
        )}

        {/* Footer meta + actions */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--hair)', gap: 6,
        }}>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}>
            sort {promo.sort_order} · {formatDate(promo.created_at || '')}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <IconBtn title="แก้ไข" onClick={onEdit}>
              <Edit3 size={12} />
            </IconBtn>
            <IconBtn title={promo.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} onClick={onToggle}>
              {promo.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
            </IconBtn>
            {promo.link_url && (
              <a href={promo.link_url} target="_blank" rel="noopener noreferrer"
                title="เปิดลิงก์ปลายทาง"
                className="admin-btn admin-btn-ghost"
                style={{ padding: 5, fontSize: 11 }}>
                <ExternalLink size={12} />
              </a>
            )}
            <IconBtn title="ลบ" onClick={onDelete} danger>
              <Trash2 size={12} />
            </IconBtn>
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
        padding: 5, fontSize: 11,
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

function PromoForm({
  value, onChange, onClose, onSaved,
}: {
  value: FormState
  onChange: (v: FormState) => void
  onClose: () => void
  onSaved: (p: Promotion) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const initialPreview = value.video_url || value.image_url || null
  const initialKind: 'image' | 'video' | null = value.video_url ? 'video' : (value.image_url ? 'image' : null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreview)
  const [previewKind, setPreviewKind] = useState<'image' | 'video' | null>(initialKind)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const isVideo = f.type.startsWith('video/')
    onChange({ ...value, image: f })
    setPreviewUrl(URL.createObjectURL(f))
    setPreviewKind(isVideo ? 'video' : 'image')
  }

  function clearImage() {
    onChange({ ...value, image: null, image_url: '', video_url: '' })
    setPreviewUrl(null)
    setPreviewKind(null)
  }

  async function save() {
    setSaving(true); setMsg('')
    const fd = new FormData()
    fd.append('title', value.title)
    fd.append('description', value.description)
    fd.append('link_url', value.link_url)
    fd.append('original_price', value.original_price)
    fd.append('discounted_price', value.discounted_price)
    fd.append('discount_label', value.discount_label)
    fd.append('badge_text', value.badge_text)
    fd.append('sort_order', value.sort_order)
    fd.append('layout', value.layout)
    fd.append('banner_row', String(value.banner_row || 1))
    fd.append('is_active', String(value.is_active))
    fd.append('show_on_home', String(value.show_on_home))
    if (value.image) {
      fd.append('image', value.image)
    } else {
      // No new file — preserve existing URLs (server clears the counterpart only on upload)
      if (value.image_url) fd.append('image_url', value.image_url)
      if (value.video_url) fd.append('video_url', value.video_url)
    }

    const url = value.id ? `/api/admin/promotions/${value.id}` : '/api/admin/promotions'
    const method = value.id ? 'PATCH' : 'POST'
    try {
      const res = await fetch(url, { method, body: fd })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'เกิดข้อผิดพลาด'); return }
      onSaved(data.promotion)
    } catch {
      setMsg('เชื่อมต่อไม่ได้')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Media upload — image OR video */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          รูปภาพ <span style={{ color: 'var(--gold-deep)' }}>หรือวิดีโอ</span>
        </p>
        {previewUrl ? (
          <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#000' }}>
            {previewKind === 'video' ? (
              <video src={previewUrl} controls muted loop playsInline
                style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block', background: '#000' }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="preview"
                style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block', background: '#000' }} />
            )}
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
            {previewKind === 'video' && (
              <span style={{
                position: 'absolute', bottom: 8, left: 8,
                padding: '3px 9px', borderRadius: 'var(--r-pill)',
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>● Video</span>
            )}
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
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              คลิกเพื่อเลือกรูปหรือวิดีโอ
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
              รูป: JPG / PNG / WEBP · วิดีโอ: MP4 / WEBM (≤ 50MB)
            </span>
          </button>
        )}
        <input
          ref={fileRef} type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }} onChange={pickFile}
        />
      </div>

      {/* Basic info */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          ข้อมูลพื้นฐาน
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldGroup label="ชื่อโปรโมชั่น *">
            <input className="admin-field" type="text" value={value.title}
              onChange={e => onChange({ ...value, title: e.target.value })}
              placeholder="เช่น Dreame X50 Ultra ลดสูงสุด 8,000 บาท"
              style={{ width: '100%', fontSize: 12.5 }} />
          </FieldGroup>
          <FieldGroup label="คำอธิบาย">
            <textarea className="admin-field" rows={2} value={value.description}
              onChange={e => onChange({ ...value, description: e.target.value })}
              placeholder="คำอธิบายสั้นๆ"
              style={{ width: '100%', fontSize: 12.5, resize: 'vertical' }} />
          </FieldGroup>
          <FieldGroup label="Link URL (ปลายทางเมื่อกดคลิก)">
            <input className="admin-field" type="url" value={value.link_url}
              onChange={e => onChange({ ...value, link_url: e.target.value })}
              placeholder="https://www.dreametech.com/products/..."
              style={{ width: '100%', fontSize: 12.5 }} />
          </FieldGroup>
        </div>
      </div>

      {/* Pricing & badges */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          ราคา & ป้าย
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FieldGroup label="ราคาเดิม (฿)">
            <input className="admin-field" type="number" value={value.original_price}
              onChange={e => onChange({ ...value, original_price: e.target.value })}
              placeholder="40990" style={{ width: '100%', fontSize: 12.5 }} />
          </FieldGroup>
          <FieldGroup label="ราคาหลังลด (฿)">
            <input className="admin-field" type="number" value={value.discounted_price}
              onChange={e => onChange({ ...value, discounted_price: e.target.value })}
              placeholder="32990" style={{ width: '100%', fontSize: 12.5 }} />
          </FieldGroup>
          <FieldGroup label="Discount label">
            <input className="admin-field" type="text" value={value.discount_label}
              onChange={e => onChange({ ...value, discount_label: e.target.value })}
              placeholder="ลด 8,000 บาท" style={{ width: '100%', fontSize: 12.5 }} />
          </FieldGroup>
          <FieldGroup label="Badge (มุมซ้ายบน)">
            <input className="admin-field" type="text" value={value.badge_text}
              onChange={e => onChange({ ...value, badge_text: e.target.value })}
              placeholder="HOT, BEST" style={{ width: '100%', fontSize: 12.5 }} />
          </FieldGroup>
        </div>
      </div>

      {/* Layout */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          รูปแบบการแสดง
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {LAYOUTS.map(l => {
            const active = value.layout === l.value
            return (
              <button key={l.value}
                onClick={() => onChange({ ...value, layout: l.value })}
                className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
                style={{
                  padding: 12, flexDirection: 'column', gap: 4,
                  alignItems: 'flex-start', textAlign: 'left',
                  fontSize: 12, height: 'auto',
                }}>
                <span style={{ fontWeight: 700 }}>{l.label}</span>
                <span style={{ fontSize: 10, opacity: active ? 0.85 : 0.7, fontWeight: 500 }}>
                  {l.description}
                </span>
              </button>
            )
          })}
        </div>
        <FieldGroup label="ลำดับ (มากกว่า = บนกว่า)">
          <input className="admin-field" type="number" value={value.sort_order}
            onChange={e => onChange({ ...value, sort_order: e.target.value })}
            style={{ width: '100%', fontSize: 12.5, marginTop: 10 }} />
        </FieldGroup>

        {/* Banner row selector — only meaningful for banner layout on home page */}
        {value.layout === 'banner' && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              แสดงในแถวที่ (เฉพาะหน้า home)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {([1, 2] as const).map(r => {
                const active = (value.banner_row || 1) === r
                return (
                  <button key={r}
                    onClick={() => onChange({ ...value, banner_row: r })}
                    className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
                    style={{ padding: 10, fontSize: 12, fontWeight: 700, justifyContent: 'center' }}>
                    แถว {r} {active && '✓'}
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--ink-faint)' }}>
              หน้า /promotions รวมทุกแถวเป็นแถวเดียว
            </p>
          </div>
        )}
      </div>

      {/* Visibility */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          การแสดงผล
        </p>
        <ToggleRow
          label="เปิดใช้งาน"
          subtitle="ถ้าปิด จะไม่แสดงทั้งใน home และ /promotions"
          checked={value.is_active}
          onChange={v => onChange({ ...value, is_active: v })}
        />
        <ToggleRow
          label="แสดงในหน้า home"
          subtitle="ถ้าปิด จะแสดงเฉพาะหน้า /promotions เท่านั้น"
          checked={value.show_on_home}
          onChange={v => onChange({ ...value, show_on_home: v })}
        />
      </div>

      {msg && (
        <p style={{
          margin: 0, padding: '8px 12px', borderRadius: 'var(--r-md)',
          background: msg.includes('สำเร็จ') ? 'var(--green-soft)' : 'var(--red-soft)',
          color: msg.includes('สำเร็จ') ? 'var(--green)' : 'var(--red)',
          fontSize: 12, fontWeight: 600,
        }}>
          {msg.includes('สำเร็จ') ? '✓ ' : '⚠️ '}{msg}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: -18, padding: '12px 0 4px', background: '#fff' }}>
        <button onClick={onClose} className="admin-btn admin-btn-ghost"
          style={{ flex: 1, padding: '10px', fontSize: 13 }}>
          ยกเลิก
        </button>
        <button onClick={save} disabled={saving || !value.title}
          className="admin-btn admin-btn-ink"
          style={{ flex: 2, padding: '10px', fontSize: 13, gap: 6 }}>
          {saving ? <Loader2 size={13} className="spinner" /> : <Save size={13} />}
          {value.id ? 'อัพเดต' : 'สร้างโปรโมชั่น'}
        </button>
      </div>
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
