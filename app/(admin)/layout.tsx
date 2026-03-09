import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = createServiceClient()
  const { data: staff } = await supabaseAdmin
    .from('admin_staff')
    .select('*')
    .eq('auth_user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!staff) redirect('/home')

  return (
    <div className="flex min-h-screen bg-gray-950">
      <div className="sticky top-0 h-screen flex-shrink-0">
        <AdminSidebar staff={staff} />
      </div>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}