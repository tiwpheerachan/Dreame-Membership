// ============================================================
// DREAME MEMBERSHIP — Type Definitions (single source of truth)
// ============================================================

export type UserTier       = 'SILVER' | 'GOLD' | 'PLATINUM'
// Backward-compat alias — prefer UserTier in new code
export type MemberTier     = UserTier
// Legacy enum values still present in DB but no longer used in new code
export type LegacyUserTier = 'PLUS' | 'PRO' | 'ULTRA' | 'MASTER'
export type ChannelType    = 'ONLINE' | 'ONSITE'
export type SaleChannel    = 'STORE' | 'SHOPEE' | 'LAZADA' | 'WEBSITE' | 'TIKTOK' | 'OTHER'
export type PurchaseStatus = 'PENDING' | 'BQ_VERIFIED' | 'ADMIN_APPROVED' | 'REJECTED'
export type PointsType     = 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADMIN_ADJUST'
export type AdminRole      = 'SUPER_ADMIN' | 'ADMIN_ONLINE' | 'ADMIN_ONSITE' | 'STAFF_ONSITE' | 'STAFF_ONLINE'
export type StaffRole      = AdminRole

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
  terms_accepted_at: string | null
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
  total_amount: number
  receipt_image_url: string | null
  bq_verified: boolean
  bq_verified_at: string | null
  bq_raw_data: BQOrderData | null
  status: PurchaseStatus
  admin_note: string | null
  approved_by: string | null
  approved_at: string | null
  points_awarded: number
  points_awarded_at: string | null
  warranty_months: number
  warranty_start: string | null
  warranty_end: string | null
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
  adjusted_by: string | null
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
  theme?: string | null
  created_at: string
}

export interface AdminStaff {
  id: string
  auth_user_id: string
  name: string
  email: string | null
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
  // For 'banner' layout (and any layout that wants a video), video_url
  // takes priority over image_url at render time.
  video_url?: string | null
  link_url: string | null
  original_price: number | null
  discounted_price: number | null
  discount_label: string | null
  badge_text: string | null
  sort_order: number
  // 'banner' is a top auto-scrolling brand carousel, full-width 3:1 aspect.
  layout: 'hero' | 'card' | 'feed' | 'banner'
  // Banner-only: pick which marquee row to appear in on home page (1 or 2).
  // Ignored for non-banner layouts and for the promotions page.
  banner_row?: 1 | 2 | null
  is_active: boolean
  show_on_home: boolean
  starts_at: string | null
  ends_at: string | null
  created_at?: string
}

// ── BigQuery payload ──
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

export interface BQOrderData {
  order_sn: string
  platform: string
  order_create_time: string
  order_date: string
  total_amount: number
  items: BQOrderItem[]
}
// Alias for back-compat
export type BQOrder = BQOrderData

// ── API responses ──
export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

export interface VerifyOrderResponse {
  status: 'VERIFIED' | 'PENDING' | 'NOT_FOUND'
  order?: BQOrderData
  message?: string
}

// ── Constants ──
// Lifetime-points lower bound for each tier
export const TIER_THRESHOLDS: Record<UserTier, number> = {
  SILVER:    0,
  GOLD:     80,
  PLATINUM: 400,
}

// Points multiplier (Platinum is the only tier with a VIP boost)
export const TIER_MULTIPLIER: Record<UserTier, number> = {
  SILVER:   1.0,
  GOLD:     1.0,
  PLATINUM: 1.2,
}

export const TIER_COLORS: Record<UserTier, string> = {
  SILVER:   '#C9D9E8',  // pearl/silver
  GOLD:     '#E89A6B',  // warm orange-gold
  PLATINUM: '#5EEAD4',  // mint/teal
}

export const TIER_LABEL: Record<UserTier, string> = {
  SILVER:   'Silver',
  GOLD:     'Gold',
  PLATINUM: 'Platinum',
}

export const TIER_RANGE: Record<UserTier, string> = {
  SILVER:   '0 – 79 points',
  GOLD:     '80 – 399 points',
  PLATINUM: '400+ points',
}

// Earn divisor: how many THB equal 1 point, depending on the sales channel.
// Web/store rewards are 2.5× more generous than platform purchases to encourage
// the strategic shift from marketplace to first-party channels.
export const EARN_DIVISOR_BY_CHANNEL: Record<SaleChannel, number> = {
  WEBSITE: 200,
  STORE:   200,
  SHOPEE:  500,
  LAZADA:  500,
  TIKTOK:  500,
  OTHER:   500,
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
  PENDING: 'รอตรวจสอบ',
  BQ_VERIFIED: 'ยืนยันแล้ว',
  ADMIN_APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
}
