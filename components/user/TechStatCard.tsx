// ============================================================
// Pill-shaped stat card — supports either a dashed solid border
// or a gradient solid border (rendered via outer-wrap trick so
// it works with rounded corners).
// ============================================================

interface Props {
  label: string         // ex. "POINTS"
  subLabel: string      // ex. "available"
  value: string         // formatted value
  // Border style: 'dashed' uses a regular CSS dashed border;
  // 'gradient' uses an outer wrapper coloured by a CSS gradient.
  variant: 'dashed' | 'gradient'
  borderColor: string   // dashed → solid hex; gradient → full CSS gradient string
  labelColor: string
  valueColor: string
  subColor?: string
}

export default function TechStatCard({
  label, subLabel, value,
  variant, borderColor, labelColor, valueColor, subColor,
}: Props) {
  const inner = (
    <div style={{
      background: '#fff',
      borderRadius: 999,
      padding: '14px 16px 13px',
      textAlign: 'center',
      minHeight: 92,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      gap: 2,
    }}>
      <p style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase',
        color: labelColor, margin: 0,
      }}>{label}</p>
      <p className="display tnum" style={{
        fontSize: 26, lineHeight: 1.05, fontWeight: 800,
        color: valueColor, margin: 0,
        letterSpacing: '-0.01em',
      }}>
        {value}
      </p>
      <p style={{
        fontSize: 11, color: subColor || '#A0A0A0',
        margin: 0, fontWeight: 500,
      }}>{subLabel}</p>
    </div>
  )

  if (variant === 'dashed') {
    return (
      <div style={{
        background: '#fff',
        border: `2px dashed ${borderColor}`,
        borderRadius: 999,
        padding: 0,
      }}>
        {inner}
      </div>
    )
  }

  // gradient border
  return (
    <div style={{
      background: borderColor,
      borderRadius: 999,
      padding: 2,
    }}>
      {inner}
    </div>
  )
}
