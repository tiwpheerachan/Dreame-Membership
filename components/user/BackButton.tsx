'use client'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/** Small circular back button. Goes to browser history, falling back to /home. */
export default function BackButton({ fallback = '/home' }: { fallback?: string }) {
  const router = useRouter()

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(fallback)
  }

  return (
    <button onClick={goBack} aria-label="ย้อนกลับ" className="tap"
      style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'var(--bg-soft)', border: '1px solid var(--hair)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink)', cursor: 'pointer', flexShrink: 0,
      }}>
      <ChevronLeft size={20} strokeWidth={2.2} />
    </button>
  )
}
