import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import CommandPalette from '@/components/admin/CommandPalette'
import { tabKeyForPath, canViewTab, firstAllowedHref, type TabAccess } from '@/lib/admin-tabs'
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

  const role = staff.role as string
  const tabAccess = (staff.tab_access ?? {}) as TabAccess

  // ── RBAC gate: block direct navigation to a tab the admin can't view ──
  const path = headers().get('x-admin-pathname') || '/admin'
  const tabKey = tabKeyForPath(path)
  if (tabKey && !canViewTab(role, tabAccess, tabKey)) {
    const fallback = firstAllowedHref(role, tabAccess)
    // Avoid a redirect loop if even the fallback is the denied path.
    if (fallback !== path) redirect(fallback)
  }

  return (
    <div className="admin-shell" style={{ display: 'flex' }}>
      <AdminSidebar staff={{ name: staff.name, role, tab_access: tabAccess }} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
      <CommandPalette />
    </div>
  )
}
