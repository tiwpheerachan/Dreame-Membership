'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Bell, Mail, MessageSquare, ArrowLeft, CheckCircle,
  Sparkles, Megaphone, AlertCircle,
} from 'lucide-react'

type NotifyPrefs = { notify_email: boolean; notify_sms: boolean }

interface Announcement {
  id: string
  title: string
  body: string | null
  image_url: string | null
  link_url: string | null
  badge_text: string | null
  created_at: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [prefs, setPrefs] = useState<NotifyPrefs>({ notify_email: true, notify_sms: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<keyof NotifyPrefs | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const [{ data: u }, { data: anns }] = await Promise.all([
        supabase.from('users').select('notify_email, notify_sms').eq('id', authUser.id).maybeSingle(),
        supabase.from('announcements').select('*').eq('is_active', true)
          .order('created_at', { ascending: false }).limit(20),
      ])

      if (u) {
        setPrefs({
          // Default to true on legacy rows where the column might be null
          notify_email: u.notify_email !== false,
          notify_sms:   u.notify_sms   !== false,
        })
      }
      setAnnouncements((anns || []) as Announcement[])
      setLoading(false)
    }
    load()
  }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2200)
  }

  async function toggle(key: keyof NotifyPrefs) {
    const next = !prefs[key]
    // Optimistic
    setPrefs(p => ({ ...p, [key]: next }))
    setSaving(key)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      })
      if (!res.ok) throw new Error()
      showToast(next ? 'เปิดการแจ้งเตือนแล้ว' : 'ปิดการแจ้งเตือนแล้ว', true)
    } catch {
      // Revert
      setPrefs(p => ({ ...p, [key]: !next }))
      showToast('บันทึกไม่สำเร็จ', false)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{
          width: 28, height: 28,
          border: '2px solid var(--ink-ghost)',
          borderTopColor: 'var(--gold)',
          borderRadius: '50%',
        }} />
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ paddingTop: 18, paddingBottom: 32, minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, padding: '10px 22px', borderRadius: 'var(--r-pill)',
          background: toast.ok ? 'var(--black)' : 'var(--red)',
          color: toast.ok ? 'var(--gold-soft)' : '#fff',
          fontSize: 12.5, fontWeight: 600,
          boxShadow: 'var(--shadow-3)',
          animation: 'fade-up 0.3s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={{ padding: '14px 20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/profile" className="tap-down" style={{
          width: 38, height: 38, borderRadius: '50%',
          background: '#fff', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink)', textDecoration: 'none',
        }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Stay Updated</p>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            <span style={{ fontWeight: 800 }}>การแจ้ง</span>{' '}
            <span className="serif-i" style={{ fontWeight: 400 }}>เตือน</span>
          </h1>
        </div>
      </header>

      {/* ── Notification preferences ── */}
      <section style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 2px 12px rgba(20,18,15,0.04)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px 10px' }}>
            <p className="kicker" style={{ margin: 0 }}>การตั้งค่า</p>
          </div>

          <ToggleRow
            Icon={Mail}
            title="อีเมล"
            subtitle="รับโปรโมชั่น คูปอง และข้อมูลคะแนนทางอีเมล"
            checked={prefs.notify_email}
            saving={saving === 'notify_email'}
            onToggle={() => toggle('notify_email')}
            tone={{ bg: '#FFEDD5', icon: '#9A6E1F' }}
          />
          <div style={{ height: 1, background: 'var(--hair)', margin: '0 18px' }} />
          <ToggleRow
            Icon={MessageSquare}
            title="SMS"
            subtitle="รับข้อความสำคัญและการแจ้งเตือนเร่งด่วน"
            checked={prefs.notify_sms}
            saving={saving === 'notify_sms'}
            onToggle={() => toggle('notify_sms')}
            tone={{ bg: '#E8F6EC', icon: '#1F6B33' }}
          />
        </div>

        <p className="serif-i" style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '10px 4px 0', lineHeight: 1.55 }}>
          การแจ้งเตือนที่จำเป็นเกี่ยวกับบัญชี (เช่น ยืนยันอีเมล รีเซ็ตรหัสผ่าน) จะถูกส่งเสมอเพื่อความปลอดภัย
        </p>
      </section>

      {/* ── Announcements feed ── */}
      <section style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px 10px' }}>
          <p className="kicker" style={{ margin: 0 }}>ข่าวสารล่าสุด</p>
          {announcements.length > 0 && (
            <span style={{
              fontSize: 10.5, color: 'var(--ink-mute)', fontWeight: 600,
              padding: '3px 9px', borderRadius: 'var(--r-pill)',
              background: 'var(--bg-soft)', border: '1px solid var(--hair)',
            }}>
              {announcements.length} รายการ
            </span>
          )}
        </div>

        {announcements.length === 0 ? (
          <div style={{
            padding: '40px 24px', textAlign: 'center',
            background: '#fff', border: '1px solid var(--hair)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 2px 12px rgba(20,18,15,0.04)',
          }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 14px',
              borderRadius: 16,
              background: 'linear-gradient(135deg,#FAF3DC,#EADBB1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#A0782B',
              boxShadow: '0 4px 14px rgba(160,120,43,0.18)',
            }}>
              <Megaphone size={22} strokeWidth={1.7} />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>ไม่มีข่าวสารใหม่</p>
            <p className="serif-i" style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
              เมื่อมีโปรโมชั่นหรือประกาศจะปรากฏที่นี่
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {announcements.map(a => <AnnouncementCard key={a.id} item={a} />)}
          </div>
        )}
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Toggle row
// ────────────────────────────────────────────────────────────────

function ToggleRow({
  Icon, title, subtitle, checked, saving, onToggle, tone,
}: {
  Icon: typeof Mail
  title: string
  subtitle: string
  checked: boolean
  saving: boolean
  onToggle: () => void
  tone: { bg: string; icon: string }
}) {
  return (
    <button
      onClick={onToggle}
      disabled={saving}
      className="tap-down"
      style={{
        width: '100%', padding: '14px 18px',
        background: 'transparent', border: 'none',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: saving ? 'not-allowed' : 'pointer',
        textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        background: tone.bg, color: tone.icon, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{title}</p>
        <p className="serif-i" style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0', lineHeight: 1.4 }}>
          {subtitle}
        </p>
      </div>
      {/* iOS-style toggle */}
      <span aria-hidden style={{
        position: 'relative', flexShrink: 0,
        width: 44, height: 26, borderRadius: 100,
        background: checked
          ? 'linear-gradient(135deg, #1A1815, #2A2419)'
          : '#E5E2DC',
        transition: 'background 0.2s ease',
        boxShadow: checked ? 'inset 0 1px 2px rgba(0,0,0,0.25)' : 'inset 0 1px 2px rgba(0,0,0,0.06)',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2,
          width: 22, height: 22, borderRadius: '50%',
          background: checked
            ? 'linear-gradient(135deg, #FAF3DC, #EADBB1, #A0782B)'
            : '#fff',
          boxShadow: '0 2px 6px rgba(20,18,15,0.20)',
          transition: 'left 0.22s cubic-bezier(0.34,1.1,0.64,1)',
        }} />
      </span>
    </button>
  )
}

// ────────────────────────────────────────────────────────────────
// Announcement card
// ────────────────────────────────────────────────────────────────

function AnnouncementCard({ item }: { item: Announcement }) {
  const date = new Date(item.created_at).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const Wrapper = item.link_url ? 'a' : 'div'

  return (
    <Wrapper
      {...(item.link_url ? { href: item.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="tap-down"
      style={{
        position: 'relative',
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: '#fff', border: '1px solid var(--hair)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 2px 12px rgba(20,18,15,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Top accent line */}
      <div aria-hidden style={{
        height: 2,
        background: 'linear-gradient(90deg, transparent 0%, #EADBB1 25%, #A0782B 50%, #EADBB1 75%, transparent 100%)',
      }} />

      <div style={{ padding: 14, display: 'flex', gap: 12 }}>
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" style={{
            width: 56, height: 56, borderRadius: 12,
            objectFit: 'cover', flexShrink: 0,
            border: '1px solid var(--hair)',
          }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: 'linear-gradient(135deg,#FAF3DC,#EADBB1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#A0782B', flexShrink: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
          }}>
            <Sparkles size={22} strokeWidth={1.7} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {item.badge_text && (
            <span style={{
              display: 'inline-block', marginBottom: 4,
              padding: '2px 8px', borderRadius: 'var(--r-pill)',
              background: 'linear-gradient(135deg,#FAF3DC,#A0782B)',
              color: '#1A1815',
              fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>
              {item.badge_text}
            </span>
          )}
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{item.title}</p>
          {item.body && (
            <p style={{
              margin: '4px 0 0', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.55,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
            }}>{item.body}</p>
          )}
          <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--ink-faint)' }}>{date}</p>
        </div>
      </div>
    </Wrapper>
  )
}
