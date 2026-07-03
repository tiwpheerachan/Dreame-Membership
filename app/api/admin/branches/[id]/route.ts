import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { uploadToSupabase } from '@/lib/upload'
import { parseKeptGallery, uploadGalleryFiles } from '@/lib/branch-gallery'

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
  let galleryUrls: string[] | undefined

  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    fd.forEach((v, k) => { if (k !== 'gallery') body[k] = v as unknown as string })
    const file = fd.get('image') as File | null
    if (file && file.size > 0) {
      const { url, error } = await uploadToSupabase(auth.service, file, 'branches', 'banner')
      if (error) return NextResponse.json({ error }, { status: 400 })
      imageUrl = url ?? undefined
    }
    // Gallery is always sent in full from the form: kept URLs + new uploads.
    if ('gallery_urls' in body) {
      const kept = parseKeptGallery(body.gallery_urls)
      const uploaded = await uploadGalleryFiles(auth.service, fd.getAll('gallery'))
      if ('error' in uploaded) return NextResponse.json({ error: uploaded.error }, { status: 400 })
      galleryUrls = [...kept, ...uploaded.urls]
    }
  } else {
    body = await req.json().catch(() => ({}))
    if ('gallery_urls' in body) galleryUrls = parseKeptGallery(body.gallery_urls)
  }

  const updates: Record<string, unknown> = {}
  const fields = ['name', 'address', 'map_url', 'phone', 'hours', 'badge_text']
  for (const f of fields) if (f in body) updates[f] = body[f] ? String(body[f]) : null
  if ('sort_order' in body)   updates.sort_order = Number(body.sort_order) || 0
  if ('is_active' in body)    updates.is_active = !(body.is_active === 'false' || body.is_active === false)
  if ('show_on_home' in body) updates.show_on_home = !(body.show_on_home === 'false' || body.show_on_home === false)
  if (galleryUrls !== undefined) updates.gallery_urls = galleryUrls

  if (imageUrl !== undefined) {
    updates.image_url = imageUrl
  } else if ('image_url' in body) {
    updates.image_url = body.image_url ? String(body.image_url) : null
  }

  let { data, error } = await auth.service.from('branches').update(updates).eq('id', params.id).select().single()
  // Retry without gallery_urls if the column doesn't exist yet (migration not run).
  if (error && /gallery_urls/.test(error.message)) {
    delete updates.gallery_urls
    const retry = await auth.service.from('branches').update(updates).eq('id', params.id).select().single()
    data = retry.data
    error = retry.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidatePath('/admin/branches')
  revalidatePath('/branches')
  revalidatePath('/home')
  return NextResponse.json({ success: true, branch: data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.service.from('branches').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidatePath('/admin/branches')
  revalidatePath('/branches')
  revalidatePath('/home')
  return NextResponse.json({ success: true })
}
