// Coupon color themes — admin selectable
export type CouponTheme = 'black' | 'gold' | 'rose' | 'lavender' | 'sage' | 'coral' | 'cream' | 'navy' | 'emerald'

interface ThemeStyle {
  label: string
  // stamp side (left of card)
  stampBg: string
  stampText: string
  stampAccent: string
  // hero of detail popup
  heroBg: string
  heroAccent: string
  heroLabel: string
}

export const COUPON_THEMES: Record<CouponTheme, ThemeStyle> = {
  black: {
    label: 'Black & Gold',
    stampBg: 'var(--black)',
    stampText: '#fff',
    stampAccent: 'var(--gold-soft)',
    heroBg: 'linear-gradient(135deg, #0E0E0E 0%, #2A2017 60%, #4A3318 100%)',
    heroAccent: 'var(--gold-soft)',
    heroLabel: 'rgba(255,255,255,0.55)',
  },
  gold: {
    label: 'Champagne Gold',
    stampBg: 'linear-gradient(135deg, #EADBB1 0%, #C9A85A 60%, #A0782B 100%)',
    stampText: '#fff',
    stampAccent: '#fff',
    heroBg: 'linear-gradient(135deg, #EADBB1 0%, #C9A85A 50%, #A0782B 100%)',
    heroAccent: '#fff',
    heroLabel: 'rgba(255,255,255,0.75)',
  },
  rose: {
    label: 'Rose Pink',
    stampBg: 'linear-gradient(135deg, #F8C8D8 0%, #D97A95 100%)',
    stampText: '#fff',
    stampAccent: '#fff',
    heroBg: 'linear-gradient(135deg, #FCE4EC 0%, #D97A95 60%, #8E2C4D 100%)',
    heroAccent: '#fff',
    heroLabel: 'rgba(255,255,255,0.78)',
  },
  lavender: {
    label: 'Lavender',
    stampBg: 'linear-gradient(135deg, #C5B5E8 0%, #7B5AB8 100%)',
    stampText: '#fff',
    stampAccent: '#fff',
    heroBg: 'linear-gradient(135deg, #DDD2F5 0%, #7B5AB8 60%, #3D2A6B 100%)',
    heroAccent: '#fff',
    heroLabel: 'rgba(255,255,255,0.78)',
  },
  sage: {
    label: 'Sage Green',
    stampBg: 'linear-gradient(135deg, #B0CFB0 0%, #5C8A5C 100%)',
    stampText: '#fff',
    stampAccent: '#fff',
    heroBg: 'linear-gradient(135deg, #CDDFC9 0%, #5C8A5C 60%, #2E4A2E 100%)',
    heroAccent: '#fff',
    heroLabel: 'rgba(255,255,255,0.78)',
  },
  coral: {
    label: 'Coral Sunset',
    stampBg: 'linear-gradient(135deg, #F9B9A0 0%, #D9603F 100%)',
    stampText: '#fff',
    stampAccent: '#fff',
    heroBg: 'linear-gradient(135deg, #FFD4C2 0%, #D9603F 60%, #6B2A1A 100%)',
    heroAccent: '#fff',
    heroLabel: 'rgba(255,255,255,0.78)',
  },
  cream: {
    label: 'Ivory Cream',
    stampBg: 'linear-gradient(135deg, #FAF3DC 0%, #D4B978 100%)',
    stampText: '#3A2810',
    stampAccent: '#7A5A1F',
    heroBg: 'linear-gradient(135deg, #FAF3DC 0%, #D4B978 60%, #8A6320 100%)',
    heroAccent: '#3A2810',
    heroLabel: 'rgba(58,40,16,0.65)',
  },
  navy: {
    label: 'Midnight Navy',
    stampBg: 'linear-gradient(135deg, #4A6E92 0%, #1A2C45 100%)',
    stampText: '#fff',
    stampAccent: '#C9A85A',
    heroBg: 'linear-gradient(135deg, #4A6E92 0%, #1A2C45 60%, #0A1525 100%)',
    heroAccent: '#C9A85A',
    heroLabel: 'rgba(255,255,255,0.65)',
  },
  emerald: {
    label: 'Emerald',
    stampBg: 'linear-gradient(135deg, #5CB39A 0%, #1F5C46 100%)',
    stampText: '#fff',
    stampAccent: '#fff',
    heroBg: 'linear-gradient(135deg, #7DC9B0 0%, #1F5C46 60%, #0E3A2A 100%)',
    heroAccent: '#fff',
    heroLabel: 'rgba(255,255,255,0.78)',
  },
}

export function getCouponTheme(theme?: string | null): ThemeStyle {
  if (theme && theme in COUPON_THEMES) return COUPON_THEMES[theme as CouponTheme]
  return COUPON_THEMES.black
}
