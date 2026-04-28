import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadToSupabase } from '@/lib/upload'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await auth.service.from('announcements').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ announcements: data })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const ct = req.headers.get('content-type') || ''
  let body: Record<string, unknown> = {}
  let imageUrl: string | null = null

  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    fd.forEach((v, k) => { body[k] = v as unknown as string })
    const file = fd.get('image') as File | null
    if (file && file.size > 0) {
      const { url, error } = await uploadToSupabase(auth.service, file, 'announcements', 'receipt')
      if (error) return NextResponse.json({ error }, { status: 400 })
      imageUrl = url ?? null
    }
  } else {
    body = await req.json().catch(() => ({}))
  }

  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await auth.service.from('announcements').insert({
    title: String(body.title).trim(),
    body: body.body ? String(body.body).trim() : null,
    image_url: imageUrl ?? (body.image_url ? String(body.image_url) : null),
    link_url: body.link_url ? String(body.link_url).trim() : null,
    badge_text: body.badge_text ? String(body.badge_text).trim() : null,
    audience: ['ALL', 'TIER', 'SEGMENT'].includes(String(body.audience)) ? body.audience : 'ALL',
    audience_tier: body.audience_tier || null,
    is_active: body.is_active === 'false' || body.is_active === false ? false : true,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    created_by: auth.staff.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, announcement: data })
}
