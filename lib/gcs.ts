// ============================================================
// Google Cloud Storage — File Upload Utility
// ============================================================
import { Storage } from '@google-cloud/storage'
import { randomUUID } from 'crypto'

let storageClient: Storage | null = null

function getStorage(): Storage {
  if (!storageClient) {
    const credentialsJson = process.env.BQ_CREDENTIALS_JSON
    if (credentialsJson) {
      storageClient = new Storage({
        projectId: process.env.GCS_PROJECT_ID,
        credentials: JSON.parse(credentialsJson),
      })
    } else {
      storageClient = new Storage({ projectId: process.env.GCS_PROJECT_ID })
    }
  }
  return storageClient
}

const BUCKET = process.env.GCS_BUCKET_NAME ?? 'dreame-membership-files'

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder: 'receipts' | 'avatars' = 'receipts'
): Promise<string | null> {
  try {
    const storage = getStorage()
    const ext = filename.split('.').pop() ?? 'jpg'
    const gcsPath = `${folder}/${randomUUID()}.${ext}`
    const bucket = storage.bucket(BUCKET)
    const file = bucket.file(gcsPath)

    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: 'public, max-age=31536000' },
    })

    await file.makePublic()
    return `https://storage.googleapis.com/${BUCKET}/${gcsPath}`
  } catch (error) {
    console.error('[GCS] Upload error:', error)
    return null
  }
}

export async function deleteFile(url: string): Promise<void> {
  try {
    const storage = getStorage()
    const path = url.replace(`https://storage.googleapis.com/${BUCKET}/`, '')
    await storage.bucket(BUCKET).file(path).delete()
  } catch (error) {
    console.error('[GCS] Delete error:', error)
  }
}
