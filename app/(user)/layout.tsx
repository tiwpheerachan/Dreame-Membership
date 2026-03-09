import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/user/Navbar'

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div style={{ minHeight:'100vh', background:'#f7f7f5', fontFamily:"'Prompt',system-ui,sans-serif" }}>
      <div style={{ maxWidth:480, margin:'0 auto', paddingBottom:'96px' }}>
        {children}
      </div>
      <Navbar />
    </div>
  )
}