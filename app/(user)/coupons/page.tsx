import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Tag } from 'lucide-react'
import type { Coupon } from '@/types'
import { formatDate } from '@/lib/utils'
import CouponCard from '@/components/user/CouponCard'

export default async function CouponsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const { data: coupons } = await supabase
    .from('coupons')
    .select('*')
    .eq('user_id', session.user.id)
    .order('valid_until', { ascending: true })

  const active = (coupons || []).filter((c: Coupon) => !c.used_at && c.valid_until >= today)
  const used = (coupons || []).filter((c: Coupon) => c.used_at)
  const expired = (coupons || []).filter((c: Coupon) => !c.used_at && c.valid_until < today)

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-white text-xl font-bold">คูปอง & โปรโมชั่น</h1>
      </div>

      {active.length === 0 && used.length === 0 && expired.length === 0 ? (
        <div className="text-center py-16">
          <Tag size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400">ยังไม่มีคูปอง</p>
          <p className="text-gray-600 text-sm mt-1">คูปองจะปรากฏที่นี่เมื่อได้รับจาก Dreame</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-white font-semibold text-sm mb-3">ใช้ได้ ({active.length})</h2>
              <div className="space-y-3">
                {active.map((c: Coupon) => <CouponCard key={c.id} coupon={c} status="active" />)}
              </div>
            </div>
          )}
          {expired.length > 0 && (
            <div>
              <h2 className="text-gray-500 font-semibold text-sm mb-3">หมดอายุ ({expired.length})</h2>
              <div className="space-y-3 opacity-60">
                {expired.map((c: Coupon) => <CouponCard key={c.id} coupon={c} status="expired" />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
