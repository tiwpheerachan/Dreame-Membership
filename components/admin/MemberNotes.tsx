'use client'
import { useEffect, useState } from 'react'
import { Pin, MessageSquare, Send } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Note {
  id: string
  body: string
  pinned: boolean
  created_at: string
  admin_staff?: { name: string } | null
}

export default function MemberNotes({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    const r = await fetch(`/api/admin/users/${userId}/notes`)
    const d = await r.json()
    if (r.ok) setNotes(d.notes || [])
  }
  useEffect(() => { load() }, [userId])

  async function save() {
    if (!body.trim()) return
    setSaving(true)
    const r = await fetch(`/api/admin/users/${userId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, pinned }),
    })
    setSaving(false)
    if (r.ok) { setBody(''); setPinned(false); load() }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 280, overflowY: 'auto' }}>
        {notes.length === 0 && (
          <div style={{
            padding: 18, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 12,
            background: 'var(--bg-soft)', borderRadius: 'var(--r-md)',
          }}>
            <MessageSquare size={18} style={{ margin: '0 auto 6px', display: 'block', color: 'var(--ink-faint)' }} />
            ยังไม่มี note
          </div>
        )}
        {notes.map(n => (
          <div key={n.id} style={{
            padding: 12,
            background: n.pinned ? 'var(--gold-glow)' : 'var(--bg-soft)',
            border: n.pinned ? '1px solid var(--gold-line)' : '1px solid transparent',
            borderRadius: 'var(--r-md)',
            fontSize: 12.5, color: 'var(--ink)',
          }}>
            {n.pinned && <Pin size={10} color="var(--gold-deep)" style={{ marginRight: 4, verticalAlign: 'baseline' }} />}
            <p style={{ margin: '0 0 6px', lineHeight: 1.5 }}>{n.body}</p>
            <p style={{ margin: 0, fontSize: 10.5, color: 'var(--ink-mute)' }}>
              {n.admin_staff?.name || 'Admin'} · {formatDateTime(n.created_at)}
            </p>
          </div>
        ))}
      </div>

      <div>
        <textarea className="admin-field" rows={2} value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="เพิ่ม note..."
          style={{ fontSize: 12, resize: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-mute)', cursor: 'pointer' }}>
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
            ปักหมุด
          </label>
          <button onClick={save} disabled={!body.trim() || saving} className="admin-btn admin-btn-ink" style={{ padding: '5px 12px', fontSize: 11 }}>
            <Send size={11} /> ส่ง
          </button>
        </div>
      </div>
    </div>
  )
}
