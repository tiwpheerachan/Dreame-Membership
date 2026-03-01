import { clsx, type ClassValue } from 'clsx'
import { format, parseISO, differenceInDays } from 'date-fns'
import { th } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy', { locale: th })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy HH:mm', { locale: th })
  } catch {
    return dateStr
  }
}

export function formatThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy', { locale: th })
  } catch {
    return dateStr
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('th-TH').format(n)
}

export function warrantyDaysLeft(warrantyEnd: string | null | undefined): number {
  if (!warrantyEnd) return 0
  try {
    return Math.max(0, differenceInDays(parseISO(warrantyEnd), new Date()))
  } catch { return 0 }
}

export function tierColor(tier: string): string {
  switch (tier) {
    case 'PLATINUM': return 'text-cyan-400'
    case 'GOLD': return 'text-yellow-400'
    default: return 'text-gray-400'
  }
}

export function tierBg(tier: string): string {
  switch (tier) {
    case 'PLATINUM': return 'bg-cyan-900/30 border-cyan-500/40'
    case 'GOLD': return 'bg-yellow-900/30 border-yellow-500/40'
    default: return 'bg-gray-800/50 border-gray-600/40'
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'ADMIN_APPROVED': case 'BQ_VERIFIED': return 'bg-green-900/30 text-green-400 border-green-500/30'
    case 'PENDING': return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30'
    case 'REJECTED': return 'bg-red-900/30 text-red-400 border-red-500/30'
    default: return 'bg-gray-900/30 text-gray-400 border-gray-500/30'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'ADMIN_APPROVED': return 'ยืนยันแล้ว'
    case 'BQ_VERIFIED': return 'ยืนยันแล้ว'
    case 'PENDING': return 'รอตรวจสอบ'
    case 'REJECTED': return 'ไม่อนุมัติ'
    default: return status
  }
}

export function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    STORE: '🏪 หน้าร้าน', SHOPEE: '🛍️ Shopee',
    LAZADA: '🛒 Lazada', WEBSITE: '🌐 Website',
    TIKTOK: '🎵 TikTok', OTHER: 'อื่นๆ',
  }
  return map[channel] ?? channel
}

export function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
