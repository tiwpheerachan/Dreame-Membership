// ============================================================
// DREAME MEMBERSHIP — Type Definitions
// ============================================================

export type MemberTier = 'SILVER' | 'GOLD' | 'PLATINUM'
export type SaleChannel = 'STORE' | 'SHOPEE' | 'LAZADA' | 'WEBSITE' | 'TIKTOK' | 'OTHER'
export type ChannelType = 'ONLINE' | 'ONSITE'
export type PurchaseStatus = 'PENDING' | 'BQ_VERIFIED' | 'ADMIN_APPROVED' | 'REJECTED'
export type PointsType = 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADMIN_ADJUST'
export type StaffRole = 'SUPER_ADMIN' | 'ADMIN_ONLINE' | 'ADMIN_ONSITE' | 'STAFF_ONSITE' | 'STAFF_ONLINE'

export interface User {
  id: string
  member_id: string
  phone?: string
  email?: string
  full_name?: string
  profile_image_url?: string
  address?: string
  total_points: number
  lifetime_points: number
  tier: MemberTier
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PurchaseRegistration {
  id: string
  user_id: string
  order_sn: string
  invoice_no?: string
  channel: SaleChannel
  channel_type: ChannelType
  sku?: string
  model_name?: string
  serial_number?: string
  purchase_date?: string
  total_amount: number
  receipt_image_url?: string
  warranty_months: number
  warranty_start?: string
  warranty_end?: string
  bq_verified: boolean
  bq_verified_at?: string
  status: PurchaseStatus
  admin_note?: string
  points_awarded: number
  created_at: string
  updated_at: string
}

export interface PointsLog {
  id: string
  user_id: string
  purchase_reg_id?: string
  points_delta: number
  type: PointsType
  description?: string
  balance_after: number
  expires_at?: string
  created_at: string
}

export interface Coupon {
  id: string
  user_id: string
  code: string
  title?: string
  description?: string
  discount_type: 'PERCENT' | 'FIXED'
  discount_value: number
  min_purchase: number
  valid_from: string
  valid_until: string
  used_at?: string
  created_at: string
}

export interface AdminStaff {
  id: string
  auth_user_id: string
  name: string
  email?: string
  role: StaffRole
  channel_access: ChannelType[]
  is_active: boolean
}

export interface BQOrderData {
  order_sn: string
  platform: string
  order_create_time: string
  order_date: string
  total_amount: number
  items: BQOrderItem[]
}

export interface BQOrderItem {
  item_id: string
  model_id: string
  item_name: string
  item_sku: string
  model_name: string
  model_sku: string
  quantity: number
  price: number
}

export interface Promotion {
  id: string
  title: string
  description?: string
  image_url?: string
  link_url?: string
  is_active: boolean
  starts_at?: string
  ends_at?: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface VerifyOrderResponse {
  status: 'VERIFIED' | 'PENDING' | 'NOT_FOUND'
  order?: BQOrderData
  message?: string
}
