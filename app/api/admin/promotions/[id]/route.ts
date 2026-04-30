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
  let videoUrl: string | undefined
  // Track whether the uploaded file was a video so we can clear the
  // counterpart field (uploading a video on a previously-image promo
  // should null out image_url and vice-versa).
  let uploadedKind: 'image' | 'video' | null = null

  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    fd.forEach((v, k) => { body[k] = v as unknown as string })
    const file = fd.get('image') as File | null
    if (file && file.size > 0) {
      const { url, error, isVideo } = await uploadToSupabase(auth.service, file, 'promotions', 'banner')
      if (error) return NextResponse.json({ error }, { status: 400 })
      if (isVideo) {
        videoUrl = url ?? undefined
        uploadedKind = 'video'
      } else {
        imageUrl = url ?? undefined
        uploadedKind = 'image'
      }
    }
  } else {
    body = await req.json().catch(() => ({}))
  }

  const updates: Record<string, unknown> = {}
  const fields = ['title','description','link_url','discount_label','badge_text','starts_at','ends_at']
  for (const f of fields) if (f in body) updates[f] = body[f] ? String(body[f]) : null
  if ('layout' in body)           updates.layout = ['hero','card','feed','banner'].includes(String(body.layout)) ? body.layout : 'card'
  if ('banner_row' in body)       updates.banner_row = Number(body.banner_row) === 2 ? 2 : 1
  if ('original_price' in body)   updates.original_price = body.original_price === '' || body.original_price == null ? null : Number(body.original_price)
  if ('discounted_price' in body) updates.discounted_price = body.discounted_price === '' || body.discounted_price == null ? null : Number(body.discounted_price)
  if ('sort_order' in body)       updates.sort_order = Number(body.sort_order) || 0
  if ('is_active' in body)        updates.is_active = !(body.is_active === 'false' || body.is_active === false)
  if ('show_on_home' in body)     updates.show_on_home = !(body.show_on_home === 'false' || body.show_on_home === false)

  // Media handling: if a fresh file was uploaded, set the matching field and
  // null out the other one. If only URL fields were supplied (no upload),
  // honour them as-is.
  if (uploadedKind === 'image') {
    updates.image_url = imageUrl
    updates.video_url = null
  } else if (uploadedKind === 'video') {
    updates.video_url = videoUrl
    updates.image_url = null
  } else {
    if ('image_url' in body) updates.image_url = body.image_url ? String(body.image_url) : null
    if ('video_url' in body) updates.video_url = body.video_url ? String(body.video_url) : null
  }

  let { data, error } = await auth.service.from('promotions').update(updates).eq('id', params.id).select().single()
  // Retry without optional columns if they don't exist yet (migration not run).
  if (error && /video_url/.test(error.message)) {
    delete updates.video_url
    const retry = await auth.service.from('promotions').update(updates).eq('id', params.id).select().single()
    data = retry.data
    error = retry.error
  }
  if (error && /banner_row/.test(error.message)) {
    delete updates.banner_row
    const retry = await auth.service.from('promotions').update(updates).eq('id', params.id).select().single()
    data = retry.data
    error = retry.error
  }
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
