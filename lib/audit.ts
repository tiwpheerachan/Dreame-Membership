import { createServiceClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'PURCHASE_APPROVED'
  | 'PURCHASE_REJECTED'
  | 'PURCHASE_ADDED'
  | 'PURCHASE_EDITED'
  | 'PURCHASE_DELETED'
  | 'PURCHASE_BQ_RECHECKED'
  | 'BQ_LOOKUP'
  | 'POINTS_ADJUSTED'
  | 'COUPON_CREATED'
  | 'MEMBER_VIEWED'

interface LogParams {
  staffId:     string
  action:      AuditAction
  targetType:  'purchase' | 'user' | 'points' | 'coupon'
  targetId?:   string  // UUID; omit for actions that target a non-UUID identifier (e.g. an order_sn)
  userId?:     string
  detail?:     Record<string, unknown>
}

export async function logAdminAction(params: LogParams) {
  try {
    const supabase = createServiceClient()
    await supabase.from('admin_audit_log').insert({
      staff_id:    params.staffId,
      action_type: params.action,
      target_type: params.targetType,
      target_id:   params.targetId || null,
      user_id:     params.userId || null,
      detail:      params.detail || null,
    })
  } catch (e) {
    // audit log ไม่ควรทำให้ request หลักพัง
    console.error('[AuditLog]', e)
  }
}

// ดึง staff info จาก session
export async function getStaffFromSession(authUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('admin_staff')
    .select('id, name, email, role')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .single()
  return data
}