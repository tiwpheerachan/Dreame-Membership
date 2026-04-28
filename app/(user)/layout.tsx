import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/user/Navbar'

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <main style={{
        maxWidth: 480, margin: '0 auto',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
        minHeight: '100vh',
        position: 'relative',
      }}>
        {children}
      </main>
      <Navbar />
    </div>
  )
}
