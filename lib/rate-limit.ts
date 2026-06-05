// ============================================================
// In-memory rate limiter
//
// เหมาะกับ single-instance deploy (เช่น Render Web Service)
// ถ้า scale horizontal ในอนาคต ค่อยย้ายไป Redis/Upstash
//
// ใช้:
//   const rl = rateLimit({ key: `coupons:${userId}`, limit: 30, windowMs: 60_000 })
//   if (!rl.allowed) return new Response('rate limited', { status: 429, headers: rl.headers })
// ============================================================

interface Bucket { count: number; resetAt: number }
const store = new Map<string, Bucket>()

const MAX_KEYS = 5000  // กัน memory blowup
function gc() {
  if (store.size <= MAX_KEYS) return
  const now = Date.now()
  for (const [k, b] of store) {
    if (b.resetAt < now) store.delete(k)
  }
  // ถ้ายังเกินอีก เคลียร์ตามอายุ
  if (store.size > MAX_KEYS) {
    const entries = Array.from(store.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt)
    for (let i = 0; i < entries.length - MAX_KEYS; i++) store.delete(entries[i][0])
  }
}

export interface RateLimitOptions {
  key:       string
  limit:     number     // requests per window
  windowMs:  number
}

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   number
  headers:   Record<string, string>
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  let b = store.get(key)
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + windowMs }
    store.set(key, b)
    gc()
  }
  b.count++
  const allowed = b.count <= limit
  const remaining = Math.max(0, limit - b.count)
  return {
    allowed,
    remaining,
    resetAt: b.resetAt,
    headers: {
      'X-RateLimit-Limit':     String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset':     String(Math.ceil(b.resetAt / 1000)),
      ...(allowed ? {} : { 'Retry-After': String(Math.ceil((b.resetAt - now) / 1000)) }),
    },
  }
}

// Helper: ดึง identifier จาก request (user id หรือ IP fallback)
export function getRateKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`
  // Render/Vercel proxy headers
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
         || req.headers.get('x-real-ip')
         || 'unknown'
  return `ip:${ip}`
}
