import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import CommandPalette from '@/components/admin/CommandPalette'
import './admin.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = createServiceClient()
  const { data: staff } = await supabaseAdmin
    .from('admin_staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff) redirect('/home')

  return (
    <div className="admin-shell" style={{ display: 'flex' }}>
      <AdminSidebar staff={staff} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
      <CommandPalette />
    </div>
  )
}
