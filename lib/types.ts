// ============================================================
// DREAME MEMBERSHIP — TypeScript Types
// ============================================================

export type UserTier = 'SILVER' | 'GOLD' | 'PLATINUM'
export type ChannelType = 'ONLINE' | 'ONSITE'
export type SaleChannel = 'STORE' | 'SHOPEE' | 'LAZADA' | 'WEBSITE' | 'TIKTOK' | 'OTHER'
export type PurchaseStatus = 'PENDING_BQ' | 'BQ_VERIFIED' | 'PENDING_ADMIN' | 'ADMIN_APPROVED' | 'REJECTED'
export type PointsType = 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADMIN_ADJUST'
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN_ONLINE' | 'ADMIN_ONSITE' | 'STAFF_ONSITE' | 'STAFF_ONLINE'

export interface User {
  id: string
  member_id: string
  phone: string | null
  email: string | null
  full_name: string | null
  profile_image_url: string | null
  address: string | null
  date_of_birth: string | null
  total_points: number
  lifetime_points: number
  tier: UserTier
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PurchaseRegistration {
  id: string
  user_id: string
  order_sn: string
  invoice_no: string | null
  channel: SaleChannel
  channel_type: ChannelType
  sku: string | null
  model_name: string | null
  item_name: string | null
  platform: string | null
  quantity: number
  serial_number: string | null
  purchase_date: string | null
  total_amount: number | null
  receipt_image_url: string | null
  bq_verified: boolean
  bq_verified_at: string | null
  status: PurchaseStatus
  admin_note: string | null
  points_awarded: number
  warranty_months: number
  warranty_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface PointsLog {
  id: string
  user_id: string
  purchase_reg_id: string | null
  points_delta: number
  balance_after: number
  type: PointsType
  description: string | null
  expires_at: string | null
  created_at: string
}

export interface Coupon {
  id: string
  user_id: string | null
  code: string
  title: string | null
  description: string | null
  discount_type: 'PERCENT' | 'FIXED'
  discount_value: number
  min_purchase: number
  max_discount: number | null
  valid_from: string
  valid_until: string
  used_at: string | null
  created_at: string
}

export interface AdminStaff {
  id: string
  auth_user_id: string
  name: string
  email: string
  role: AdminRole
  channel_access: ChannelType[]
  is_active: boolean
  created_at: string
}

export interface Promotion {
  id: string
  title: string
  description: string | null
  image_url: string | null
  start_date: string
  end_date: string
  is_active: boolean
}

// BigQuery order data
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

export interface BQOrder {
  order_sn: string
  platform: string
  shop_id: string
  order_create_time: string
  order_date: string
  total_amount: number
  items: BQOrderItem[]
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface VerifyOrderResponse {
  status: 'VERIFIED' | 'PENDING' | 'NOT_FOUND'
  message: string
  order?: BQOrder
}

export const TIER_THRESHOLDS: Record<UserTier, number> = {
  SILVER: 0,
  GOLD: 500,
  PLATINUM: 2000,
}

export const TIER_MULTIPLIER: Record<UserTier, number> = {
  SILVER: 1.0,
  GOLD: 1.5,
  PLATINUM: 2.0,
}

export const TIER_COLORS: Record<UserTier, string> = {
  SILVER: '#94A3B8',
  GOLD: '#D4941A',
  PLATINUM: '#7DD3FC',
}

export const CHANNEL_LABELS: Record<SaleChannel, string> = {
  STORE: 'หน้าร้าน',
  SHOPEE: 'Shopee',
  LAZADA: 'Lazada',
  WEBSITE: 'Website',
  TIKTOK: 'TikTok Shop',
  OTHER: 'อื่นๆ',
}

export const STATUS_LABELS: Record<PurchaseStatus, string> = {
  PENDING_BQ: 'รอยืนยัน',
  BQ_VERIFIED: 'ยืนยันแล้ว',
  PENDING_ADMIN: 'รอ Admin อนุมัติ',
  ADMIN_APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
}
