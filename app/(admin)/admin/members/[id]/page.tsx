import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield, Package, ExternalLink } from 'lucide-react'
import { formatDate, formatDateTime, statusLabel, statusColor, channelLabel, warrantyDaysLeft } from '@/lib/utils'
import AdjustPointsForm from '@/components/admin/AdjustPointsForm'
import ApprovePurchaseButtons from '@/components/admin/ApprovePurchaseButtons'
import AddPurchaseForm from '@/components/admin/AddPurchaseForm'
import DeletePurchaseButton from '@/components/admin/DeletePurchaseButton'

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const [{ data: user }, { data: purchases }, { data: pointsLog }, { data: staffList }] = await Promise.all([
    supabase.from('users').select('*').eq('id', params.id).single(),
    supabase.from('purchase_registrations')
      .select('*').eq('user_id', params.id).order('created_at', { ascending: false }),
    supabase.from('points_log')
      .select('*').eq('user_id', params.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('admin_staff').select('id, name, role'),
  ])

  const staffMap = Object.fromEntries(
    (staffList || []).map((s: Record<string, unknown>) => [s.id as string, s.name as string])
  )

  if (!user) notFound()

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/members" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-white text-xl font-bold">{user.full_name || 'สมาชิก'}</h1>
          <p className="text-gray-400 text-sm font-mono">{user.member_id}</p>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full border ${
          user.tier === 'PLATINUM' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-800/40' :
          user.tier === 'GOLD'     ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40' :
                                     'bg-gray-800 text-gray-400 border-gray-700'
        }`}>{user.tier}</span>
      </div>

      {/* Info + Points */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h2 className="text-white font-semibold text-sm border-b border-gray-800 pb-2">ข้อมูลสมาชิก</h2>
          {([
            ['เบอร์โทร', user.phone], ['อีเมล', user.email],
            ['ที่อยู่', user.address], ['สมาชิกตั้งแต่', formatDate(user.created_at)],
          ] as [string, string][]).map(([k, v]) => v ? (
            <div key={k}>
              <p className="text-gray-500 text-xs">{k}</p>
              <p className="text-gray-300 text-sm break-all">{v}</p>
            </div>
          ) : null)}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h2 className="text-white font-semibold text-sm border-b border-gray-800 pb-2">คะแนนสะสม</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-amber-400 font-black text-2xl">{user.total_points.toLocaleString()}</p>
              <p className="text-gray-500 text-xs mt-0.5">คงเหลือ</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-white font-bold text-2xl">{user.lifetime_points.toLocaleString()}</p>
              <p className="text-gray-500 text-xs mt-0.5">สะสมตลอดกาล</p>
            </div>
          </div>
          <AdjustPointsForm userId={user.id} currentPoints={user.total_points} />
        </div>
      </div>

      {/* ===== PURCHASE HISTORY ===== */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-amber-400" />
            <h2 className="text-white font-semibold text-sm">
              ประวัติสินค้า
              <span className="ml-2 text-gray-500 font-normal">({purchases?.length || 0} รายการ)</span>
            </h2>
          </div>
          <AddPurchaseForm userId={user.id} userName={user.full_name || 'สมาชิก'} />
        </div>

        {(purchases || []).length === 0 ? (
          <div className="py-12 text-center">
            <Package size={36} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">ยังไม่มีประวัติการซื้อ</p>
            <p className="text-gray-600 text-xs mt-1">กดปุ่ม "เพิ่มประวัติการซื้อ" ด้านบนเพื่อเพิ่มรายการ</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {(purchases || []).map((p: Record<string, unknown>) => {
              const daysLeft = warrantyDaysLeft(p.warranty_end as string)
              const warrantyOk = daysLeft > 0
              return (
                <div key={p.id as string} className="p-4 hover:bg-gray-800/20 transition-colors group">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">
                        {p.model_name as string || `Order: ${p.order_sn as string}`}
                      </p>
                      <p className="text-gray-500 text-xs font-mono mt-0.5">{p.order_sn as string}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColor(p.status as string)}`}>
                        {statusLabel(p.status as string)}
                      </span>
                      {/* ปุ่มลบ — แสดงเมื่อ hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DeletePurchaseButton
                          purchaseId={p.id as string}
                          orderSn={p.order_sn as string}
                          modelName={p.model_name as string}
                          pointsAwarded={Number(p.points_awarded)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Detail row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                    <span>{channelLabel(p.channel as string)}</span>
                    {Number(p.total_amount) > 0 && <span className="text-gray-400">฿{Number(p.total_amount).toLocaleString()}</span>}
                    {Boolean(p.serial_number) && <span className="font-mono text-gray-400">S/N: {String(p.serial_number)}</span>}
                    {Boolean(p.sku) && <span>SKU: {String(p.sku)}</span>}
                    {Boolean(p.purchase_date) && <span>{formatDate(String(p.purchase_date))}</span>}
                    {Number(p.points_awarded) > 0 && <span className="text-amber-400 font-semibold">+{Number(p.points_awarded)} แต้ม</span>}
                  </div>

                  {/* Warranty */}
                  {Boolean(p.warranty_end) && (
                    <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                      warrantyOk ? 'bg-green-900/20 text-green-400 border border-green-800/30'
                                 : 'bg-gray-800/60 text-gray-500 border border-gray-700/40'
                    }`}>
                      <Shield size={11} />
                      {warrantyOk
                        ? `ประกันคงเหลือ ${daysLeft} วัน (ถึง ${formatDate(String(p.warranty_end))})`
                        : `ประกันหมด ${formatDate(String(p.warranty_end))}`}
                    </div>
                  )}

                  {/* Receipt link */}
                  {Boolean(p.receipt_image_url) && (
                    <a href={String(p.receipt_image_url)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 ml-2 transition-colors">
                      <span className="inline-flex"><ExternalLink size={11} /></span> ดูใบเสร็จ
                    </a>
                  )}

                  {/* Admin note */}
                  {Boolean(p.admin_note) && (
                    <p className="text-gray-600 text-xs mt-1.5 italic">หมายเหตุ: {String(p.admin_note)}</p>
                  )}

                  {/* Approver info */}
                  {p.approved_by && (p.status === 'ADMIN_APPROVED' || p.status === 'REJECTED') && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-600">
                      <span>{p.status === 'REJECTED' ? '❌' : '✅'}</span>
                      <span>{p.status === 'REJECTED' ? 'ปฏิเสธโดย' : 'อนุมัติโดย'}:</span>
                      <span className="text-amber-500/80 font-medium">{staffMap[p.approved_by as string] || 'Admin'}</span>
                      {Boolean(p.approved_at) && (
                        <span className="text-gray-700">· {formatDateTime(String(p.approved_at))}</span>
                      )}
                    </div>
                  )}

                  {/* Approve buttons for pending */}
                  {p.status === 'PENDING' && (
                    <div className="mt-2 pt-2 border-t border-gray-800/50">
                      <ApprovePurchaseButtons purchaseId={p.id as string} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Points log */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">ประวัติแต้ม</h2>
        </div>
        <div className="divide-y divide-gray-800/40">
          {(pointsLog || []).map((log: Record<string, unknown>) => (
            <div key={log.id as string} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 text-sm truncate">{log.description as string || '-'}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-gray-600 text-xs">{formatDateTime(log.created_at as string)}</p>
                  {Boolean(log.adjusted_by) && staffMap[log.adjusted_by as string] && (
                    <span className="flex items-center gap-1 text-xs text-amber-600/70">
                      <span>·</span>
                      <span>โดย</span>
                      <span className="font-medium text-amber-500/80">{staffMap[log.adjusted_by as string]}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`font-bold text-sm ${Number(log.points_delta) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(log.points_delta) > 0 ? '+' : ''}{Number(log.points_delta).toLocaleString()}
                </p>
                <p className="text-gray-600 text-xs">คงเหลือ {Number(log.balance_after).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {(pointsLog || []).length === 0 && (
            <div className="py-8 text-center text-gray-500 text-sm">ยังไม่มีประวัติแต้ม</div>
          )}
        </div>
      </div>
    </div>
  )
}