// Shared upload helpers — file validation + Supabase Storage upload
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const ALLOWED_RECEIPT_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
])

export type UploadKind = 'avatar' | 'receipt'

export interface UploadResult {
  url?: string
  error?: string
}

export function validateUpload(file: File, kind: UploadKind): string | null {
  if (!file || file.size === 0) return 'ไม่พบไฟล์'
  if (file.size > MAX_FILE_SIZE) return 'ไฟล์ใหญ่เกิน 10MB'
  const allowed = kind === 'avatar' ? ALLOWED_IMAGE_TYPES : ALLOWED_RECEIPT_TYPES
  if (!allowed.has(file.type.toLowerCase())) {
    return 'ประเภทไฟล์ไม่รองรับ'
  }
  return null
}

const SAFE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

// Pick extension from MIME (not filename) so attackers can't smuggle .html/.svg etc.
function safeExtension(file: File): string {
  return SAFE_EXT[file.type.toLowerCase()] ?? 'bin'
}

export async function uploadToSupabase(
  client: SupabaseClient,
  file: File,
  folder: string,
  kind: UploadKind,
  bucket = 'dreame-files'
): Promise<UploadResult> {
  const validationError = validateUpload(file, kind)
  if (validationError) return { error: validationError }

  const ext = safeExtension(file)
  const path = `${folder}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await client.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) {
    console.error('[Upload]', error)
    return { error: 'อัพโหลดไม่สำเร็จ' }
  }

  const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(path)
  return { url: publicUrl }
}
