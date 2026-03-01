import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/LandingPage'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect('/home')
  return <LandingPage />
}