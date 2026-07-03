// Shared helpers for branch gallery image handling (used by the branches API).
import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadToSupabase } from '@/lib/upload'

/** Parse the JSON array of existing gallery URLs the admin chose to keep. */
export function parseKeptGallery(raw: unknown): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(String(raw))
    return Array.isArray(arr) ? arr.filter((u): u is string => typeof u === 'string' && !!u) : []
  } catch {
    return []
  }
}

/** Upload any newly-added gallery files, returning their public URLs. */
export async function uploadGalleryFiles(
  service: SupabaseClient,
  entries: FormDataEntryValue[],
): Promise<{ urls: string[] } | { error: string }> {
  const urls: string[] = []
  for (const entry of entries) {
    const file = entry as File
    if (!file || typeof file === 'string' || file.size === 0) continue
    const { url, error } = await uploadToSupabase(service, file, 'branches', 'banner')
    if (error) return { error }
    if (url) urls.push(url)
  }
  return { urls }
}
