'use client'
import { useState, useMemo } from 'react'
import { Gift, Bell, Check, Clock, X, Store, Calendar } from 'lucide-react'
import type { Privilege } from '@/app/(user)/privileges/page'
import {
  effectiveStatus, nextActionableRound, remainingRounds, daysBetween,
  formatThaiDate, countdownText, ROUND_META, REMIND_DAYS_BEFORE,
  type RefillRound, type EffectiveRoundStatus,
} from '@/lib/refill'

interface Props { privileges: Privilege[] }

type Tab = 'active' | 'history'

export default function PrivilegesClient({ privileges }: Props) {
  const [tab, setTab] = useState<Tab>('active')

  // ── หา "รอบที่ต้องรีบ" ทั้งระบบ เพื่อโชว์ banner เตือนบนสุด ──
  const alerts = useMemo(() => {
    const list: { priv: Privilege; round: RefillRound; days: number; status: EffectiveRoundStatus }[] = []
    for (const p of privileges) {
      const nr = nextActionableRound(p.rounds)
      if (!nr) continue
      const st = effectiveStatus(nr)
      const days = daysBetween(nr.due_date)
      // แจ้งเมื่อ: รับได้แล้ว (claimable) หรือ ใกล้ถึงภายใน 5 วัน
      if (st === 'claimable' || (st === 'upcoming' && days <= REMIND_DAYS_BEFORE)) {
        list.push({ priv: p, round: nr, days, status: st })
      }
    }
    return list.sort((a, b) => a.days - b.days)
  }, [privileges])

  const totalRemaining = useMemo(
    () => privileges.reduce((s, p) => s + remainingRounds(p.rounds), 0),
    [privileges],
  )

  return (
    <div className="page-enter" style={{ paddingTop: 18 }}>
      <header style={{ padding: '14px 20px 16px' }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Member Exclusive</p>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>สิทธิ</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>พิเศษ</span>
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink-mute)' }}>
          รับน้ำยาทำความสะอาดฟรี ทุก 6 เดือน · เหลือสิทธิรวม{' '}
          <b style={{ color: 'var(--gold-deep)' }}>{totalRemaining}</b> ครั้ง
        </p>
      </header>

      {/* ── Banner เตือนอัจฉริยะ ── */}
      {alerts.length > 0 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(a => {
            const claimable = a.status === 'claimable'
            return (
              <div key={a.round.id} style={{
                display: 'flex', gap: 12, alignItems: 'center',
                padding: '12px 14px', borderRadius: 14,
                background: claimable ? '#E7F4EC' : 'var(--gold-glow)',
                border: `1px solid ${claimable ? 'rgba(31,122,77,0.25)' : 'var(--gold-line)'}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: claimable ? '#1F7A4D' : 'var(--gold-deep)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  <Bell size={17} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    {claimable
                      ? `รับน้ำยาฟรีได้เลย — รอบที่ ${a.round.round_no}`
                      : `ใกล้ถึงกำหนดรับ — ${countdownText(a.days)}`}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.priv.model || 'ออเดอร์'} · รอบ {a.round.round_no}/{a.priv.total_rounds} ·{' '}
                    {claimable ? `หมดเขต ${formatThaiDate(a.round.claim_close)}` : `กำหนด ${formatThaiDate(a.round.due_date)}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ padding: '8px 16px 0', display: 'flex', gap: 8 }}>
        {([['active', 'สิทธิของฉัน'], ['history', 'ประวัติ']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className="tap-down" style={{
            flex: 1, padding: '10px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
            background: tab === t ? 'var(--ink)' : 'var(--surface)',
            color: tab === t ? '#fff' : 'var(--ink-mute)',
            border: `1px solid ${tab === t ? 'var(--ink)' : 'var(--hair)'}`,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'active'
          ? privileges.map(p => <PrivilegeCard key={p.id} priv={p} />)
          : <HistoryList privileges={privileges} />}
      </div>
    </div>
  )
}

// ── การ์ดสิทธิ 1 ออเดอร์ + timeline 4 รอบ ──
function PrivilegeCard({ priv }: { priv: Privilege }) {
  const remaining = remainingRounds(priv.rounds)
  return (
    <div className="card-product" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--hair)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'var(--gold-glow)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--gold-deep)',
          }}>
            <Gift size={20} strokeWidth={1.6} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
              {priv.model || 'สิทธิรับน้ำยาฟรี'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-faint)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {priv.transaction_id && <span>#{priv.transaction_id}</span>}
              {priv.branch && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Store size={10} />{priv.branch}</span>}
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999,
            background: remaining > 0 ? 'var(--gold-glow)' : '#F0F0F0',
            color: remaining > 0 ? 'var(--gold-deep)' : 'var(--ink-faint)',
            whiteSpace: 'nowrap',
          }}>เหลือ {remaining} ครั้ง</span>
        </div>
      </div>

      {/* timeline */}
      <div style={{ padding: '6px 16px 14px' }}>
        {priv.rounds.map((r, i) => (
          <RoundRow key={r.id} round={r} total={priv.total_rounds} last={i === priv.rounds.length - 1} />
        ))}
      </div>
    </div>
  )
}

function RoundRow({ round, total, last }: { round: RefillRound; total: number; last: boolean }) {
  const st = effectiveStatus(round)
  const meta = ROUND_META[st]
  const days = daysBetween(round.due_date)
  const Icon = st === 'claimed' ? Check : st === 'expired' ? X : st === 'claimable' ? Gift : Clock
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      {/* dot + line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26 }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', marginTop: 10, flexShrink: 0,
          background: meta.bg, color: meta.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: st === 'claimable' ? `2px solid ${meta.color}` : '1px solid transparent',
        }}>
          <Icon size={13} strokeWidth={2.2} />
        </div>
        {!last && <div style={{ flex: 1, width: 2, background: 'var(--hair)', minHeight: 14 }} />}
      </div>
      {/* content */}
      <div style={{ flex: 1, padding: '10px 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            รอบที่ {round.round_no}<span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> / {total}</span>
          </p>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Calendar size={11} />
          {formatThaiDate(round.due_date)}
          {st === 'upcoming' && <span style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>· {countdownText(days)}</span>}
          {st === 'claimable' && <span style={{ color: '#1F7A4D', fontWeight: 600 }}>· รับได้ถึง {formatThaiDate(round.claim_close)}</span>}
          {st === 'claimed' && round.claimed_at && <span>· รับเมื่อ {formatThaiDate(round.claimed_at.slice(0, 10))}</span>}
        </p>
      </div>
    </div>
  )
}

// ── แท็บประวัติ: รอบที่รับแล้ว / หมดสิทธิ ทั้งหมด ──
function HistoryList({ privileges }: { privileges: Privilege[] }) {
  const rows = privileges.flatMap(p =>
    p.rounds
      .map(r => ({ p, r, st: effectiveStatus(r) }))
      .filter(x => x.st === 'claimed' || x.st === 'expired'),
  ).sort((a, b) => (b.r.due_date).localeCompare(a.r.due_date))

  if (rows.length === 0) {
    return (
      <div className="card-product" style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>ยังไม่มีประวัติการรับ</p>
      </div>
    )
  }
  return (
    <>
      {rows.map(({ p, r, st }) => {
        const meta = ROUND_META[st]
        return (
          <div key={r.id} className="card-product" style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {st === 'claimed' ? <Check size={14} /> : <X size={14} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{p.model || 'ออเดอร์'} · รอบ {r.round_no}/{p.total_rounds}</p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--ink-faint)' }}>
                {st === 'claimed' && r.claimed_at ? `รับเมื่อ ${formatThaiDate(r.claimed_at.slice(0, 10))}` : `กำหนด ${formatThaiDate(r.due_date)}`}
              </p>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: meta.bg, color: meta.color }}>{meta.label}</span>
          </div>
        )
      })}
    </>
  )
}
