// ============================================================
// Refill-privilege helpers (สิทธิรับน้ำยาฟรี)
//
// สถานะรอบเก็บใน DB เป็น upcoming | claimed | expired
// แต่ "claimable" (เปิดรับตอนนี้) คำนวณสดจากวันที่ — helper นี้รวม logic
// ให้ทั้งหน้า user, admin และ cron ใช้ตรงกัน
// ============================================================

export type StoredRoundStatus = 'upcoming' | 'claimed' | 'expired'
// สถานะที่แสดงผล (คำนวณสด)
export type EffectiveRoundStatus = 'claimed' | 'expired' | 'claimable' | 'upcoming'

export interface RefillRound {
  id: string
  round_no: number
  due_date: string       // 'YYYY-MM-DD'
  claim_open: string     // 'YYYY-MM-DD'
  claim_close: string    // 'YYYY-MM-DD'
  status: StoredRoundStatus
  claimed_at: string | null
  claimed_by?: string | null
  claim_note?: string | null
}

// วันนี้แบบ local date (เที่ยงคืน) — string 'YYYY-MM-DD'
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// สถานะจริงที่ควรแสดง — DB เป็นแหล่งความจริงของ claimed;
// ที่เหลือคำนวณจากวันที่เทียบ today
export function effectiveStatus(r: Pick<RefillRound, 'status' | 'claim_open' | 'claim_close'>, today = todayISO()): EffectiveRoundStatus {
  if (r.status === 'claimed') return 'claimed'
  if (today > r.claim_close) return 'expired'          // เลยหน้าต่างรับ → ตัดสิทธิ
  if (today >= r.claim_open) return 'claimable'        // อยู่ในช่วงรับได้
  return 'upcoming'                                    // ยังไม่ถึงกำหนด
}

// จำนวนวันจาก today ถึง target (บวก = อนาคต, ลบ = อดีต)
export function daysBetween(target: string, today = todayISO()): number {
  const a = new Date(today + 'T00:00:00')
  const b = new Date(target + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

// รอบถัดไปที่ควรโฟกัส: claimable ก่อน แล้วค่อย upcoming ที่ใกล้สุด
export function nextActionableRound(rounds: RefillRound[], today = todayISO()): RefillRound | null {
  const sorted = [...rounds].sort((a, b) => a.round_no - b.round_no)
  const claimable = sorted.find(r => effectiveStatus(r, today) === 'claimable')
  if (claimable) return claimable
  return sorted.find(r => effectiveStatus(r, today) === 'upcoming') || null
}

// จำนวนรอบที่ยังใช้สิทธิได้ (ยังไม่รับ + ยังไม่หมดอายุ)
export function remainingRounds(rounds: RefillRound[], today = todayISO()): number {
  return rounds.filter(r => {
    const s = effectiveStatus(r, today)
    return s === 'claimable' || s === 'upcoming'
  }).length
}

// meta สำหรับ badge UI
export const ROUND_META: Record<EffectiveRoundStatus, { label: string; color: string; bg: string }> = {
  claimable: { label: 'รับได้เลย',  color: '#1F7A4D', bg: '#E7F4EC' },
  upcoming:  { label: 'รอถึงรอบ',   color: '#8A6D2B', bg: '#F5EBD0' },
  claimed:   { label: 'รับแล้ว',     color: '#6E6E6E', bg: '#F0F0F0' },
  expired:   { label: 'หมดสิทธิ',    color: '#B14242', bg: '#F7E9E9' },
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// 'YYYY-MM-DD' → '15 ก.ย. 2026' (พ.ศ.)
export function formatThaiDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d.getTime())) return '-'
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

// ข้อความนับถอยหลังแบบเป็นมิตร
export function countdownText(days: number): string {
  if (days < 0) return `เลยกำหนด ${Math.abs(days)} วัน`
  if (days === 0) return 'วันนี้'
  if (days === 1) return 'พรุ่งนี้'
  return `อีก ${days} วัน`
}

// จำนวนวันก่อนครบกำหนดที่จะเริ่มเตือน
export const REMIND_DAYS_BEFORE = 5
