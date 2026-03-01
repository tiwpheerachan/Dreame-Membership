import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MemberCard from '@/components/user/MemberCard'
import { Package, Star, Tag, ChevronRight, Gift } from 'lucide-react'
import type { User, PurchaseRegistration, Promotion } from '@/types'
import { formatDate, statusLabel, statusColor } from '@/lib/utils'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const [{ data: user }, { data: recentPurchases }, { data: promotions }] = await Promise.all([
    supabase.from('users').select('*').eq('id', session.user.id).single(),
    supabase.from('purchase_registrations').select('*').eq('user_id', session.user.id)
      .order('created_at', { ascending: false }).limit(3),
    supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
  ])

  if (!user) redirect('/login')

  const tierInfo = {
    SILVER:   { next: 'Gold', needed: 500 - user.lifetime_points, max: 500 },
    GOLD:     { next: 'Platinum', needed: 2000 - user.lifetime_points, max: 2000 },
    PLATINUM: { next: null, needed: 0, max: 2000 },
  }
  const ti = tierInfo[user.tier as keyof typeof tierInfo]
  const progress = user.tier === 'PLATINUM' ? 100 : Math.min(100, Math.round(user.lifetime_points / ti.max * 100))

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <div>
          <p className="text-gray-400 text-sm">สวัสดี 👋</p>
          <h1 className="text-white text-xl font-bold">{user.full_name || 'สมาชิก'}</h1>
        </div>
        <Link href="/profile">
          {user.profile_image_url ? (
            <img src={user.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-amber-500" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center">
              <span className="text-amber-400 font-bold">{(user.full_name || 'D')[0].toUpperCase()}</span>
            </div>
          )}
        </Link>
      </div>

      {/* Member Card */}
      <MemberCard user={user as User} />

      {/* Tier Progress */}
      {user.tier !== 'PLATINUM' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-xs">อีก <span className="text-amber-400 font-bold">{Math.max(0, ti.needed)}</span> แต้ม เพื่อขึ้น {ti.next}</span>
            <span className="text-gray-500 text-xs">{progress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-400 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/purchases/register" className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 hover:bg-amber-500/20 transition-colors">
          <Package className="text-amber-400" size={22} />
          <div>
            <p className="text-white text-sm font-semibold">ลงทะเบียน</p>
            <p className="text-gray-400 text-xs">สินค้า/ประกัน</p>
          </div>
        </Link>
        <Link href="/points" className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3 hover:bg-gray-800 transition-colors">
          <Star className="text-yellow-400" size={22} />
          <div>
            <p className="text-white text-sm font-semibold">{user.total_points.toLocaleString()}</p>
            <p className="text-gray-400 text-xs">คะแนนสะสม</p>
          </div>
        </Link>
      </div>

      {/* Recent Purchases */}
      {recentPurchases && recentPurchases.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-white font-semibold text-sm">ประวัติล่าสุด</h2>
            <Link href="/purchases" className="text-amber-400 text-xs flex items-center gap-1">ดูทั้งหมด <ChevronRight size={14} /></Link>
          </div>
          {(recentPurchases as PurchaseRegistration[]).map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 last:border-0">
              <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{p.model_name || p.order_sn}</p>
                <p className="text-gray-500 text-xs">{formatDate(p.purchase_date || p.created_at)}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border ${statusColor(p.status)}`}>
                {statusLabel(p.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Promotions */}
      {promotions && promotions.length > 0 && (
        <div>
          <h2 className="text-white font-semibold text-sm mb-2">โปรโมชั่น</h2>
          <div className="space-y-2">
            {(promotions as Promotion[]).map(promo => (
              <div key={promo.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {promo.image_url && <img src={promo.image_url} alt={promo.title} className="w-full h-32 object-cover" />}
                <div className="p-3">
                  <p className="text-white text-sm font-medium">{promo.title}</p>
                  {promo.description && <p className="text-gray-400 text-xs mt-1">{promo.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
