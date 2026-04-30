import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

const EDITABLE_FIELDS = [
  'title', 'description', 'discount_type', 'discount_value',
  'min_purchase', 'valid_until', 'theme',
] as const

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))

  // Restore mode: clear used_at so a previously-redeemed coupon can be used again.
  if (body.mode === 'restore') {
    const { data, error } = await service
      .from('coupons')
      .update({ used_at: null, used_count: 0 })
      .eq('id', params.id)
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    revalidatePath('/admin/coupons')
    return NextResponse.json({ success: true, coupon: data })
  }

  // Edit mode (default): update arbitrary editable fields.
  const updates: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in body) {
      const v = body[key]
      if (key === 'discount_value' || key === 'min_purchase') {
        updates[key] = v === null || v === '' ? 0 : Number(v)
      } else {
        updates[key] = v === '' ? null : v
      }
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no editable fields provided' }, { status: 400 })
  }

  const { data, error } = await service
    .from('coupons').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  revalidatePath('/admin/coupons')
  return NextResponse.json({ success: true, coupon: data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await service.from('coupons').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  revalidatePath('/admin/coupons')
  return NextResponse.json({ success: true })
}
