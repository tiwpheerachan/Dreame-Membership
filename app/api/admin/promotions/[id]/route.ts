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
  return { service }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const ct = req.headers.get('content-type') || ''
  let body: Record<string, unknown> = {}
  let imageUrl: string | undefined

  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    fd.forEach((v, k) => { body[k] = v as unknown as string })
    const file = fd.get('image') as File | null
    if (file && file.size > 0) {
      const { url, error } = await uploadToSupabase(auth.service, file, 'promotions', 'receipt')
      if (error) return NextResponse.json({ error }, { status: 400 })
      imageUrl = url ?? undefined
    }
  } else {
    body = await req.json().catch(() => ({}))
  }

  const updates: Record<string, unknown> = {}
  const fields = ['title','description','link_url','discount_label','badge_text','starts_at','ends_at']
  for (const f of fields) if (f in body) updates[f] = body[f] ? String(body[f]) : null
  if ('layout' in body)           updates.layout = ['hero','card','feed'].includes(String(body.layout)) ? body.layout : 'card'
  if ('original_price' in body)   updates.original_price = body.original_price === '' || body.original_price == null ? null : Number(body.original_price)
  if ('discounted_price' in body) updates.discounted_price = body.discounted_price === '' || body.discounted_price == null ? null : Number(body.discounted_price)
  if ('sort_order' in body)       updates.sort_order = Number(body.sort_order) || 0
  if ('is_active' in body)        updates.is_active = !(body.is_active === 'false' || body.is_active === false)
  if ('show_on_home' in body)     updates.show_on_home = !(body.show_on_home === 'false' || body.show_on_home === false)
  if (imageUrl !== undefined)     updates.image_url = imageUrl
  else if ('image_url' in body)   updates.image_url = body.image_url ? String(body.image_url) : null

  const { data, error } = await auth.service.from('promotions').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, promotion: data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.service.from('promotions').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
