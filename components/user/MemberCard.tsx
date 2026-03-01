import type { User } from '@/types'
import { formatDate } from '@/lib/utils'
import { Shield, Star } from 'lucide-react'

interface Props { user: User }

const tierConfig = {
  SILVER:   { label: 'Silver', gradient: 'from-gray-500 to-gray-400', icon: '🥈' },
  GOLD:     { label: 'Gold',   gradient: 'from-amber-600 to-yellow-400', icon: '🥇' },
  PLATINUM: { label: 'Platinum', gradient: 'from-cyan-700 to-cyan-400', icon: '💎' },
}

export default function MemberCard({ user }: Props) {
  const tc = tierConfig[user.tier]
  return (
    <div className={`relative rounded-2xl p-5 bg-gradient-to-br ${tc.gradient} shadow-xl overflow-hidden`}>
      {/* Pattern */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({length:6}).map((_,i) => (
          <div key={i} className="absolute rounded-full border border-white"
            style={{ width: 80+i*60, height: 80+i*60, top: -20, right: -20, opacity: 1-i*0.15 }} />
        ))}
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{tc.icon}</span>
              <span className="text-white/90 font-semibold text-sm">{tc.label} Member</span>
            </div>
            <p className="text-white/70 text-xs mt-1">Dreame Membership</p>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
            <Star size={12} className="text-white" />
            <span className="text-white text-sm font-bold">{user.total_points.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <p className="text-white text-lg font-bold">{user.full_name || 'สมาชิก Dreame'}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white/70 text-xs font-mono">{user.member_id}</span>
            <span className="text-white/50 text-xs">|</span>
            <span className="text-white/70 text-xs">สมาชิกตั้งแต่ {formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
