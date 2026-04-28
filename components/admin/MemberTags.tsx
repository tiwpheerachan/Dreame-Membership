'use client'
import { useState } from 'react'
import { X, Plus, Crown, Ban } from 'lucide-react'

interface Props {
  userId: string
  initialTags: string[]
  initialVip: boolean
  initialBlacklisted: boolean
}

export default function MemberTags({ userId, initialTags, initialVip, initialBlacklisted }: Props) {
  const [tags, setTags] = useState<string[]>(initialTags || [])
  const [input, setInput] = useState('')
  const [vip, setVip] = useState(initialVip)
  const [blk, setBlk] = useState(initialBlacklisted)
  const [saving, setSaving] = useState(false)

  async function patch(payload: Record<string, unknown>) {
    setSaving(true)
    await fetch(`/api/admin/users/${userId}/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
  }

  function addTag() {
    const t = input.trim()
    if (!t || tags.includes(t)) { setInput(''); return }
    const next = [...tags, t]
    setTags(next); setInput('')
    patch({ tags: next })
  }
  function removeTag(t: string) {
    const next = tags.filter(x => x !== t)
    setTags(next)
    patch({ tags: next })
  }
  function toggleVip() {
    setVip(v => { patch({ is_vip: !v }); return !v })
  }
  function toggleBlk() {
    setBlk(v => { patch({ is_blacklisted: !v }); return !v })
  }

  return (
    <div>
      {/* Flags */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button onClick={toggleVip} className={`admin-btn ${vip ? 'admin-btn-gold' : 'admin-btn-ghost'}`} style={{ padding: '5px 10px', fontSize: 11 }}>
          <Crown size={11} /> VIP
        </button>
        <button onClick={toggleBlk} className={`admin-btn ${blk ? 'admin-btn-danger' : 'admin-btn-ghost'}`} style={{ padding: '5px 10px', fontSize: 11 }}>
          <Ban size={11} /> Blacklist
        </button>
        {saving && <span style={{ fontSize: 10, color: 'var(--ink-faint)', alignSelf: 'center' }}>...</span>}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {tags.map(t => (
          <span key={t} className="admin-pill admin-pill-blue" style={{ paddingRight: 4 }}>
            {t}
            <button onClick={() => removeTag(t)} style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: 'inherit', display: 'inline-flex', padding: 0, marginLeft: 2,
            }}><X size={10} /></button>
          </span>
        ))}
        {tags.length === 0 && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>ยังไม่มี tag</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="admin-field" type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
          placeholder="เพิ่ม tag... (Enter)"
          style={{ fontSize: 12 }} />
        <button onClick={addTag} disabled={!input.trim()} className="admin-btn admin-btn-ink" style={{ padding: '6px 10px', fontSize: 11 }}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}
