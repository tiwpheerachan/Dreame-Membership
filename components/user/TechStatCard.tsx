// ============================================================
// Pill-shaped stat card with a solid pastel background. No border.
// Compact padding so the strip stays slim ("ไม่อวบ").
// ============================================================

interface Props {
  label: string         // ex. "POINTS"
  subLabel: string      // ex. "available"
  value: string         // formatted value
  bgColor: string       // solid pastel background hex
}

export default function TechStatCard({ label, subLabel, value, bgColor }: Props) {
  return (
    <div style={{
      background: bgColor,
      borderRadius: 999,
      padding: '7px 14px 6px',
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <p style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(60, 67, 80, 0.75)', margin: 0,
      }}>{label}</p>
      <p className="display tnum" style={{
        fontSize: 19, lineHeight: 1.1, fontWeight: 800,
        color: '#1F2937', margin: '1px 0',
        letterSpacing: '-0.01em',
      }}>
        {value}
      </p>
      <p style={{
        fontSize: 9.5, color: 'rgba(60, 67, 80, 0.55)',
        margin: 0, fontWeight: 500,
      }}>{subLabel}</p>
    </div>
  )
}
