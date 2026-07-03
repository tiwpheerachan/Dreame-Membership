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
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await auth.service.from('branches')
    .select('*')
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ branches: data })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const ct = req.headers.get('content-type') || ''
  let body: Record<string, unknown> = {}
  let imageUrl: string | null = null
  let galleryUrls: string[] = []

  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    fd.forEach((v, k) => { if (k !== 'gallery') body[k] = v as unknown as string })
    const file = fd.get('image') as File | null
    if (file && file.size > 0) {
      const { url, error } = await uploadToSupabase(auth.service, file, 'branches', 'banner')
      if (error) return NextResponse.json({ error }, { status: 400 })
      imageUrl = url ?? null
    }
    // Gallery: keep the URLs the client kept + upload any newly-added files.
    galleryUrls = parseKeptGallery(body.gallery_urls)
    const uploaded = await uploadGalleryFiles(auth.service, fd.getAll('gallery'))
    if ('error' in uploaded) return NextResponse.json({ error: uploaded.error }, { status: 400 })
    galleryUrls = [...galleryUrls, ...uploaded.urls]
  } else {
    body = await req.json().catch(() => ({}))
    galleryUrls = parseKeptGallery(body.gallery_urls)
  }

  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const insert: Record<string, unknown> = {
    name: String(body.name).trim(),
    image_url: imageUrl ?? (body.image_url ? String(body.image_url) : null),
    gallery_urls: galleryUrls,
    address: body.address ? String(body.address).trim() : null,
    map_url: body.map_url ? String(body.map_url).trim() : null,
    phone: body.phone ? String(body.phone).trim() : null,
    hours: body.hours ? String(body.hours).trim() : null,
    badge_text: body.badge_text ? String(body.badge_text).trim() : null,
    sort_order: body.sort_order ? Number(body.sort_order) : 0,
    is_active: body.is_active === 'false' || body.is_active === false ? false : true,
    show_on_home: body.show_on_home === 'false' || body.show_on_home === false ? false : true,
  }

  let { data, error } = await auth.service.from('branches').insert(insert).select().single()
  // Retry without gallery_urls if the column doesn't exist yet (migration not run).
  if (error && /gallery_urls/.test(error.message)) {
    delete insert.gallery_urls
    const retry = await auth.service.from('branches').insert(insert).select().single()
    data = retry.data
    error = retry.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidatePath('/admin/branches')
  revalidatePath('/branches')
  revalidatePath('/home')
  return NextResponse.json({ success: true, branch: data })
}
