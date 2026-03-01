import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/user/Navbar'

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto pb-24">
        {children}
      </div>
      <Navbar />
    </div>
  )
}
