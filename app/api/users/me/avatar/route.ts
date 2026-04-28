import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadToSupabase } from '@/lib/upload'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const service = createServiceClient()
  const { url, error } = await uploadToSupabase(service, file, `avatars/${user.id}`, 'avatar')
  if (error || !url) {
    return NextResponse.json({ error: error || 'Upload failed' }, { status: 400 })
  }

  await service
    .from('users')
    .update({ profile_image_url: url })
    .eq('id', user.id)

  return NextResponse.json({ url })
}
