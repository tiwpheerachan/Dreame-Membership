import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  // ใช้ Supabase Storage แทน GCS — ไม่ต้องตั้งค่าเพิ่ม
  const serviceSupabase = createServiceClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `avatars/${session.user.id}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await serviceSupabase.storage
    .from('dreame-files')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[Avatar] Upload error:', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get public URL
  const { data: { publicUrl } } = serviceSupabase.storage
    .from('dreame-files')
    .getPublicUrl(path)

  // Save to user profile
  await serviceSupabase
    .from('users')
    .update({ profile_image_url: publicUrl })
    .eq('id', session.user.id)

  return NextResponse.json({ url: publicUrl })
}