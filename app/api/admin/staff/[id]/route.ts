import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { ADMIN_TABS } from '@/lib/admin-tabs'

const VALID_TAB_KEYS = new Set(ADMIN_TABS.map(t => t.key))

// Keep only known tab keys with a valid level; drop anything else.
function sanitizeTabAccess(raw: unknown): Record<string, 'view' | 'edit'> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Record<string, 'view' | 'edit'> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (VALID_TAB_KEYS.has(k) && (v === 'view' || v === 'edit')) out[k] = v
  }
  return out
}

async function requireSuperAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, role').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff || staff.role !== 'SUPER_ADMIN') return { error: 'SUPER_ADMIN only', status: 403 as const }
  return { service }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const allowed = ['name', 'role', 'channel_access', 'is_active'] as const
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) updates[k] = body[k]

  if ('tab_access' in body) {
    const clean = sanitizeTabAccess(body.tab_access)
    if (clean === null) return NextResponse.json({ error: 'tab_access ต้องเป็น object { tabKey: view|edit }' }, { status: 400 })
    updates.tab_access = clean
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 })
  }

  const { error } = await auth.service.from('admin_staff').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidatePath('/admin/staff')
  return NextResponse.json({ success: true })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Soft-disable instead of delete (preserve audit_log FKs)
  const { error } = await auth.service.from('admin_staff').update({ is_active: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidatePath('/admin/staff')
  return NextResponse.json({ success: true })
}
