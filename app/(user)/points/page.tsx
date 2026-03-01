import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Star, TrendingUp, TrendingDown, RefreshCw, Settings } from 'lucide-react'
import type { User, PointsLog } from '@/types'
import { formatDateTime, formatDate } from '@/lib/utils'
import { getNextTierInfo } from '@/lib/points'

const pointsTypeConfig = {
  EARNED:      { label: 'ได้รับ', icon: TrendingUp, color: 'text-green-400', prefix: '+' },
  REDEEMED:    { label: 'แลก',   icon: TrendingDown, color: 'text-red-400', prefix: '-' },
  EXPIRED:     { label: 'หมดอายุ', icon: RefreshCw, color: 'text-gray-500', prefix: '-' },
  ADMIN_ADJUST:{ label: 'ปรับโดย Admin', icon: Settings, color: 'text-amber-400', prefix: '' },
}

export default async function PointsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const [{ data: user }, { data: logs }] = await Promise.all([
    supabase.from('users').select('*').eq('id', session.user.id).single(),
    supabase.from('points_log').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50),
  ])

  if (!user) redirect('/login')

  const tierInfo = getNextTierInfo(user.tier, user.lifetime_points)
  const tierColors = { SILVER: 'text-gray-400', GOLD: 'text-yellow-400', PLATINUM: 'text-cyan-400' }
  const tierBgs = {
    SILVER: 'from-gray-700 to-gray-500',
    GOLD: 'from-amber-700 to-yellow-400',
    PLATINUM: 'from-cyan-700 to-cyan-400',
  }

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-white text-xl font-bold">คะแนนสะสม</h1>
      </div>

      {/* Points summary card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">คะแนนคงเหลือ</p>
            <p className="text-white text-4xl font-black mt-1">
              {user.total_points.toLocaleString()}
              <span className="text-amber-400 text-lg ml-1">แต้ม</span>
            </p>
          </div>
          <div className={`flex flex-col items-center gap-1 bg-gradient-to-br ${tierBgs[user.tier as keyof typeof tierBgs]} p-3 rounded-xl`}>
            <Star size={20} className="text-white" />
            <span className="text-white text-xs font-bold">{user.tier}</span>
          </div>
        </div>

        {/* Tier progress */}
        {tierInfo.nextTier && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>แต้มสะสมตลอดกาล: <span className="text-white">{user.lifetime_points.toLocaleString()}</span></span>
              <span>อีก {tierInfo.pointsNeeded} แต้ม → {tierInfo.nextTier}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className={`h-2 rounded-full bg-gradient-to-r ${tierBgs[user.tier as keyof typeof tierBgs]}`} style={{ width: `${tierInfo.progress}%` }} />
            </div>
          </div>
        )}

        {user.tier === 'PLATINUM' && (
          <div className="text-center text-cyan-400 text-sm font-medium">
            💎 คุณอยู่ในระดับสูงสุด Platinum แล้ว!
          </div>
        )}

        {/* Tier benefits */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
          {[{t:'SILVER',m:'1x'},{t:'GOLD',m:'1.5x'},{t:'PLATINUM',m:'2x'}].map(({t,m}) => (
            <div key={t} className={`text-center p-2 rounded-lg ${user.tier === t ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-gray-800/50'}`}>
              <p className={`text-xs font-semibold ${user.tier === t ? 'text-amber-400' : 'text-gray-500'}`}>{t}</p>
              <p className={`text-lg font-bold ${user.tier === t ? 'text-white' : 'text-gray-600'}`}>{m}</p>
              <p className={`text-xs ${user.tier === t ? 'text-gray-300' : 'text-gray-600'}`}>แต้ม</p>
            </div>
          ))}
        </div>
      </div>

      {/* Points log */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">ประวัติแต้ม</h2>
        </div>
        {!logs || logs.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">ยังไม่มีประวัติ</div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {(logs as PointsLog[]).map(log => {
              const cfg = pointsTypeConfig[log.type]
              const Icon = cfg.icon
              return (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{log.description || cfg.label}</p>
                    <p className="text-gray-500 text-xs">{formatDateTime(log.created_at)}</p>
                    {log.expires_at && log.type === 'EARNED' && (
                      <p className="text-gray-600 text-xs">หมดอายุ {formatDate(log.expires_at)}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${cfg.color}`}>
                      {cfg.prefix}{log.points_delta > 0 ? '+' : ''}{log.points_delta.toLocaleString()}
                    </p>
                    <p className="text-gray-600 text-xs">{log.balance_after.toLocaleString()} แต้ม</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
