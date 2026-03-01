'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User, Phone, Mail, MapPin, Camera, LogOut, Save } from 'lucide-react'
import type { User as UserType } from '@/types'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')
      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (data) {
        setUser(data)
        setForm({ full_name: data.full_name || '', phone: data.phone || '', email: data.email || '', address: data.address || '' })
      }
    }
    load()
  }, [])

  async function save() {
    setSaving(true); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { error } = await supabase.from('users').update(form).eq('id', session.user.id)
    setSaving(false)
    setMsg(error ? 'บันทึกไม่สำเร็จ' : 'บันทึกสำเร็จแล้ว ✓')
    setTimeout(() => setMsg(''), 3000)
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/users/me/avatar', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setUser(u => u ? { ...u, profile_image_url: data.url } : u)
    setUploading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-white text-xl font-bold">โปรไฟล์</h1>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="relative">
          {user.profile_image_url ? (
            <img src={user.profile_image_url} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-amber-500/50" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-amber-500/20 border-4 border-amber-500/50 flex items-center justify-center">
              <User size={36} className="text-amber-400" />
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="absolute bottom-0 right-0 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
            <Camera size={14} className="text-gray-900" />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
        <div className="text-center">
          <p className="text-white font-semibold">{user.full_name}</p>
          <p className="text-gray-400 text-sm font-mono">{user.member_id}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
            user.tier === 'PLATINUM' ? 'bg-cyan-900/30 text-cyan-400' :
            user.tier === 'GOLD' ? 'bg-yellow-900/30 text-yellow-400' :
            'bg-gray-800 text-gray-400'
          }`}>{user.tier} Member</span>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        <h2 className="text-white font-semibold text-sm">ข้อมูลส่วนตัว</h2>

        {[
          { key: 'full_name', label: 'ชื่อ-นามสกุล', icon: User, type: 'text', placeholder: 'ชื่อ นามสกุล' },
          { key: 'phone', label: 'เบอร์โทรศัพท์', icon: Phone, type: 'tel', placeholder: '0812345678' },
          { key: 'email', label: 'อีเมล', icon: Mail, type: 'email', placeholder: 'you@example.com' },
        ].map(({ key, label, icon: Icon, type, placeholder }) => (
          <div key={key}>
            <label className="block text-xs text-gray-400 mb-1">{label}</label>
            <div className="relative">
              <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type={type} placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm" />
            </div>
          </div>
        ))}

        <div>
          <label className="block text-xs text-gray-400 mb-1">ที่อยู่</label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-3 text-gray-500" />
            <textarea placeholder="บ้านเลขที่ ถนน แขวง เขต จังหวัด"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm resize-none" />
          </div>
        </div>

        {msg && <p className={`text-sm text-center ${msg.includes('ไม่') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}

        <button onClick={save} disabled={saving}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 text-sm">
          <Save size={16} />
          {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'คะแนน', value: user.total_points.toLocaleString() },
          { label: 'สะสมทั้งหมด', value: user.lifetime_points.toLocaleString() },
          { label: 'Tier', value: user.tier },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-white font-bold text-sm">{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-red-400 bg-red-900/10 border border-red-900/30 rounded-xl py-3 text-sm hover:bg-red-900/20 transition-colors">
        <LogOut size={16} /> ออกจากระบบ
      </button>
    </div>
  )
}
