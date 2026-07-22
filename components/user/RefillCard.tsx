// สิทธิรับน้ำยาฟรี — แสดงบนการ์ดสินค้า (compact) และหน้ารายละเอียด (full)
// สถานะ "รับแล้ว" อิงตามที่แอดมินกดยืนยันรับ (refill_rounds.status = 'claimed')
import { Droplets, Check } from 'lucide-react'
import {
  effectiveStatus, nextActionableRound, formatThaiDate, countdownText,
  daysBetween, ROUND_META, type RefillRound,
} from '@/lib/refill'

// ── บรรทัดสรุปบนการ์ดสินค้า (list) ──
export function RefillLine({ rounds }: { rounds: RefillRound[] }) {
  if (!rounds || rounds.length === 0) return null
  const total = rounds.length
  const claimed = rounds.filter(r => effectiveStatus(r) === 'claimed').length
  const claimable = rounds.find(r => effectiveStatus(r) === 'claimable')
  const next = nextActionableRound(rounds)

  let tail: string
  let tone = { color: '#8A6D2B', bg: '#F7F1E0' }
  if (claimable) {
    tail = `รับได้เลย · รอบ ${claimable.round_no}`
    tone = { color: '#1F7A4D', bg: '#E7F4EC' }
  } else if (claimed >= total) {
    tail = 'รับครบแล้ว'
    tone = { color: '#6E6E6E', bg: '#F0F0F0' }
  } else if (next) {
    tail = `รอบหน้า ${formatThaiDate(next.due_date)}`
  } else {
    tail = 'สิ้นสุดสิทธิ'
    tone = { color: '#6E6E6E', bg: '#F0F0F0' }
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
      padding: '3px 9px 3px 7px', borderRadius: 999,
      background: tone.bg, color: tone.color,
      fontSize: 10.5, fontWeight: 700, alignSelf: 'flex-start',
    }}>
      <Droplets size={12} strokeWidth={2.2} />
      น้ำยาฟรี · รับแล้ว {claimed}/{total} · {tail}
    </div>
  )
}

// ── รายละเอียดเต็มในหน้าสินค้า (detail) ──
export function RefillDetail({ rounds }: { rounds: RefillRound[] }) {
  if (!rounds || rounds.length === 0) return null
  const total = rounds.length
  const claimed = rounds.filter(r => effectiveStatus(r) === 'claimed').length
  const sorted = [...rounds].sort((a, b) => a.round_no - b.round_no)

  return (
    <div className="surface" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Droplets size={15} color="var(--gold-deep)" />
        <p className="kicker" style={{ margin: 0 }}>สิทธิรับน้ำยาฟรี</p>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--ink)' }}>
          รับแล้ว {claimed}/{total} ครั้ง
        </span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '0 0 12px', lineHeight: 1.5 }}>
        รับน้ำยาฟรีทุก 6 เดือน (สิทธิ Brand Shop) — พนักงานกดยืนยันเมื่อรับของแล้ว
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(r => {
          const st = effectiveStatus(r)
          const meta = ROUND_META[st]
          const days = daysBetween(r.due_date)
          return (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 'var(--r-md)',
              background: 'var(--bg-soft)', border: '1px solid var(--hair)',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: st === 'claimed' ? '#E7F0E9' : '#fff',
                border: `1px solid ${st === 'claimed' ? '#BBD9C3' : 'var(--hair)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: st === 'claimed' ? '#1F7A4D' : 'var(--ink-mute)',
              }}>
                {st === 'claimed' ? <Check size={14} strokeWidth={2.6} /> : r.round_no}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
                  รอบ {r.round_no} · {formatThaiDate(r.due_date)}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--ink-mute)' }}>
                  {st === 'claimed'
                    ? (r.claimed_at ? `รับแล้ว ${formatThaiDate(r.claimed_at.slice(0, 10))}` : 'รับแล้ว')
                    : st === 'claimable'
                      ? `รับได้ถึง ${formatThaiDate(r.claim_close)}`
                      : st === 'upcoming'
                        ? countdownText(days)
                        : 'เลยกำหนดรับ'}
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                color: meta.color, background: meta.bg, flexShrink: 0,
              }}>
                {meta.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
