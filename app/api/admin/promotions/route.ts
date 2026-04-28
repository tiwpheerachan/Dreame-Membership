import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadToSupabase } from '@/lib/upload'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await auth.service.from('promotions')
    .select('*')
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ promotions: data })
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
      const { url, error } = await uploadToSupabase(auth.service, file, 'promotions', 'receipt')
      if (error) return NextResponse.json({ error }, { status: 400 })
      imageUrl = url ?? null
    }
  } else {
    body = await req.json().catch(() => ({}))
  }

  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const layout = ['hero', 'card', 'feed'].includes(String(body.layout)) ? String(body.layout) : 'card'

  const insert: Record<string, unknown> = {
    title: String(body.title).trim(),
    description: body.description ? String(body.description).trim() : null,
    image_url: imageUrl ?? (body.image_url ? String(body.image_url) : null),
    link_url: body.link_url ? String(body.link_url).trim() : null,
    original_price: body.original_price ? Number(body.original_price) : null,
    discounted_price: body.discounted_price ? Number(body.discounted_price) : null,
    discount_label: body.discount_label ? String(body.discount_label).trim() : null,
    badge_text: body.badge_text ? String(body.badge_text).trim() : null,
    sort_order: body.sort_order ? Number(body.sort_order) : 0,
    layout,
    is_active: body.is_active === 'false' || body.is_active === false ? false : true,
    show_on_home: body.show_on_home === 'false' || body.show_on_home === false ? false : true,
    starts_at: body.starts_at ? String(body.starts_at) : null,
    ends_at: body.ends_at ? String(body.ends_at) : null,
  }

  let { data, error } = await auth.service.from('promotions').insert(insert).select().single()

  // Retry without show_on_home if column doesn't exist yet
  if (error && /show_on_home/.test(error.message)) {
    delete insert.show_on_home
    const retry = await auth.service.from('promotions').insert(insert).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, promotion: data })
}
