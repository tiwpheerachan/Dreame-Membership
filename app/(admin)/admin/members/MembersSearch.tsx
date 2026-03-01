'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Search, Filter } from 'lucide-react'

export default function MembersSearch() {
  const router = useRouter()
  const sp = useSearchParams()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push('?' + params.toString())
  }, [router, sp])

  return (
    <div className="flex gap-3">
      <div className="flex-1 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="ค้นหาชื่อ, เบอร์, อีเมล, Member ID..."
          defaultValue={sp.get('q') || ''}
          onChange={e => {
            const value = e.target.value
            const timer = setTimeout(() => update('q', value), 400)
            return () => clearTimeout(timer)
          }}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dreame-400"
        />
      </div>
      <select
        defaultValue={sp.get('tier') || ''}
        onChange={e => update('tier', e.target.value)}
        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dreame-400 bg-white"
      >
        <option value="">ทุก Tier</option>
        <option value="SILVER">Silver</option>
        <option value="GOLD">Gold</option>
        <option value="PLATINUM">Platinum</option>
      </select>
    </div>
  )
}
