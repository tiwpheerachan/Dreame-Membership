// ============================================================
// Warranty rules per product type (ระยะเวลาการรับประกันสินค้า)
//
// Source of truth: Dreame official warranty table. Each product type has
// a multi-tier warranty — the main body, a secondary component group
// (battery/motor/compressor…) and consumables (usually no warranty).
//
// The product's "type" is inferred from its model_name via keyword match
// (`classifyProduct`). If nothing matches we fall back to the generic
// 2-year main body / 1-year components rule, which covers the bulk of
// Dreame's catalogue (robot vacuums, cordless vacuums, wet & dry, etc.).
// ============================================================
import { parseISO, differenceInDays } from 'date-fns'

/** One warranty tier. `months: null` means the part carries no warranty. */
export interface WarrantyTier {
  key: 'main' | 'secondary' | 'consumable'
  label: string          // e.g. "ตัวเครื่องหลัก", "แบตเตอรี่ / มอเตอร์"
  detail?: string        // parts covered, shown small under the label
  months: number | null
}

export interface WarrantyRule {
  category: string       // display name of the product type
  /** 'repair' = Repairible, 'replacement' = Replacement Only. */
  service: 'repair' | 'replacement'
  tiers: WarrantyTier[]  // always includes the 'main' tier first
}

// Shared component/consumable descriptions from the table.
const MAIN_BODY_DETAIL =
  'บอร์ดหลัก, กล้อง, มอเตอร์ดูดฝุ่น, เซนเซอร์, กล่องฝุ่น, ถังน้ำ, แท่นชาร์จ, ฐานเก็บฝุ่น/ล้างอัตโนมัติ'
const CONSUMABLE_DETAIL =
  'ไส้กรองกล่องฝุ่น, ผ้าม็อบ, แปรงข้าง, แปรงหลัก, ฝาครอบแปรง, ไส้กรองถังน้ำ, อุปกรณ์ทำความสะอาด, น้ำยา ฯลฯ'

// Standard consumer group: main body 2y, key components 1y, consumables none.
function standard(category: string, secondaryLabel = 'ล้อหลัก, แบตเตอรี่, ชุดทำความร้อน (Instant heater)'): WarrantyRule {
  return {
    category,
    service: 'repair',
    tiers: [
      { key: 'main',       label: 'ตัวเครื่องหลัก', detail: MAIN_BODY_DETAIL, months: 24 },
      { key: 'secondary',  label: 'ชิ้นส่วนหลัก',   detail: secondaryLabel,   months: 12 },
      { key: 'consumable', label: 'อะไหล่สิ้นเปลือง', detail: CONSUMABLE_DETAIL, months: null },
    ],
  }
}

// Large appliance group: longer main body + long compressor/motor cover.
function appliance(category: string, mainMonths: number, motorMonths: number): WarrantyRule {
  return {
    category,
    service: 'repair',
    tiers: [
      { key: 'main',       label: 'ตัวเครื่องหลัก',   detail: MAIN_BODY_DETAIL,      months: mainMonths },
      { key: 'secondary',  label: 'คอมเพรสเซอร์ / มอเตอร์', months: motorMonths },
      { key: 'consumable', label: 'อะไหล่สิ้นเปลือง',   detail: CONSUMABLE_DETAIL,    months: null },
    ],
  }
}

export type WarrantyCategoryKey =
  | 'robot_vacuum' | 'vacuum' | 'wet_dry' | 'air_purifier' | 'water_purifier'
  | 'kitchen' | 'mower' | 'hair_dryer' | 'induction' | 'range_hood'
  | 'washing_machine' | 'refrigerator' | 'db40' | 'dd20' | 'personal_care' | 'generic'

const RULES: Record<WarrantyCategoryKey, WarrantyRule> = {
  robot_vacuum:    standard('Robot Vacuum'),
  vacuum:          standard('Vacuum Cleaner'),
  wet_dry:         standard('Wet & Dry'),
  air_purifier:    standard('Air Purifier'),
  water_purifier:  standard('Water Purifier'),
  kitchen:         standard('Kitchen'),
  mower:           standard('Robotic Mower'),
  hair_dryer:      standard('Hair Dryer', 'อุปกรณ์เสริม / แบตเตอรี่'),
  induction:       standard('Induction Cooker'),
  range_hood:      standard('Range Hood'),
  washing_machine: appliance('Washing Machine', 36, 180), // 3y / 15y
  refrigerator:    appliance('Refrigerator', 24, 240),    // 2y / 20y
  db40:            appliance('Dreame DB40', 36, 120),     // 3y / 10y
  dd20:            appliance('Dreame DD20', 36, 60),      // 3y / 5y
  personal_care: {
    category: 'Personal Care',
    service: 'replacement',
    tiers: [
      { key: 'main',       label: 'ตัวสินค้าหลัก', months: 24 },
      { key: 'consumable', label: 'อุปกรณ์เสริม',   months: null },
    ],
  },
  generic:         standard('สินค้า Dreame'),
}

/** Classify a product into a warranty category from its model/item name. */
export function classifyProduct(modelName: string | null | undefined): WarrantyCategoryKey {
  const s = (modelName || '').toLowerCase()
  if (!s) return 'generic'

  // Specific models first (they'd otherwise match broader keywords).
  if (s.includes('db40')) return 'db40'
  if (s.includes('dd20')) return 'dd20'
  if (/washing|washer|เครื่องซัก/.test(s)) return 'washing_machine'
  if (/refriger|fridge|ตู้เย็น/.test(s)) return 'refrigerator'

  if (/mower|ตัดหญ้า/.test(s)) return 'mower'  // before 'robot' — "roboticmower"
  if (/robot\s*vacuum|robot|หุ่นยนต์ดูดฝุ่น/.test(s)) return 'robot_vacuum'
  if (/wet\s*&?\s*dry|เปียก.*แห้ง/.test(s)) return 'wet_dry'
  if (/air\s*purifier|เครื่องฟอกอากาศ/.test(s)) return 'air_purifier'
  if (/water\s*purifier|เครื่องกรองน้ำ/.test(s)) return 'water_purifier'
  if (/hair|dryer|ไดร์|เป่าผม/.test(s)) return 'hair_dryer'
  if (/induction|เตาแม่เหล็ก|เตาไฟฟ้า/.test(s)) return 'induction'
  if (/range\s*hood|hood|เครื่องดูดควัน/.test(s)) return 'range_hood'
  if (/kitchen|ครัว/.test(s)) return 'kitchen'
  if (/toothbrush|shaver|trimmer|personal\s*care|แปรงสีฟัน/.test(s)) return 'personal_care'
  if (/vacuum|ดูดฝุ่น/.test(s)) return 'vacuum'

  return 'generic'
}

/** Full warranty rule for a product (by model name). */
export function getWarrantyRule(modelName: string | null | undefined): WarrantyRule {
  return RULES[classifyProduct(modelName)]
}

/** Main-body warranty length in months — used when storing warranty_end. */
export function mainWarrantyMonths(modelName: string | null | undefined): number {
  const main = getWarrantyRule(modelName).tiers.find(t => t.key === 'main')
  return main?.months ?? 24
}

/** Add whole months to a YYYY-MM-DD (or ISO) date, returning YYYY-MM-DD. */
export function addMonths(startISO: string, months: number): string {
  const d = new Date(startISO)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

/** Days from today until an end date (0 if past / invalid). */
export function daysUntil(endISO: string | null | undefined): number {
  if (!endISO) return 0
  try {
    return Math.max(0, differenceInDays(parseISO(endISO), new Date()))
  } catch {
    return 0
  }
}

export interface ComputedTier extends WarrantyTier {
  endDate: string | null   // YYYY-MM-DD, null when no warranty
  daysLeft: number         // 0 when expired or no warranty
  active: boolean
}

/**
 * Resolve a product's warranty tiers to concrete end dates + remaining days,
 * computed from the warranty start (falls back to purchase date).
 */
export function computeWarranty(
  modelName: string | null | undefined,
  startISO: string | null | undefined,
): { rule: WarrantyRule; start: string | null; tiers: ComputedTier[] } {
  const rule = getWarrantyRule(modelName)
  const start = startISO ? startISO.split('T')[0] : null
  const tiers: ComputedTier[] = rule.tiers.map(t => {
    if (t.months == null || !start) {
      return { ...t, endDate: null, daysLeft: 0, active: false }
    }
    const endDate = addMonths(start, t.months)
    const daysLeft = daysUntil(endDate)
    return { ...t, endDate, daysLeft, active: daysLeft > 0 }
  })
  return { rule, start, tiers }
}
