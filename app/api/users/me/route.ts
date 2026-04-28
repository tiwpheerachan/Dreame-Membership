import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Note: email is intentionally excluded — changing it must go through
// supabase.auth.updateUser({ email }) so Supabase sends the confirmation
// email and keeps auth.users.email in sync. Use a dedicated endpoint
// (or call from the client) for that.
const ALLOWED_FIELDS = ['full_name', 'phone', 'address', 'date_of_birth'] as const
type AllowedField = typeof ALLOWED_FIELDS[number]

export async function GET() {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: user } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  return NextResponse.json({ user })
}

export async function PATCH(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Allowlist — never trust client to send tier/points/etc.
  const updates: Partial<Record<AllowedField, unknown>> = {}
  for (const k of ALLOWED_FIELDS) {
    if (k in body) {
      const v = body[k]
      // Trim strings, coerce empty → null
      updates[k] = typeof v === 'string' ? (v.trim() || null) : v
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Lightweight format validation
  if (typeof updates.phone === 'string' && !/^[0-9+\-\s]{6,20}$/.test(updates.phone)) {
    return NextResponse.json({ error: 'เบอร์โทรไม่ถูกต้อง' }, { status: 400 })
  }

  // Use service client because RLS now blocks user UPDATE on users table
  const service = createServiceClient()
  const { error } = await service.from('users').update(updates).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
