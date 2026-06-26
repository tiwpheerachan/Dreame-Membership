import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Next.js 14 patches global fetch and caches GET requests in its Data Cache by
// default. supabase-js calls fetch under the hood, so server-component reads
// (points, tier, registrations…) would be served STALE after a mutation unless
// each page opts out with `force-dynamic`. Forcing `no-store` on every Supabase
// request makes all server reads fresh app-wide — the single source of truth
// for "did my points update" instead of per-page caching flags.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' })

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: noStoreFetch },
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: Record<string, unknown>) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: Record<string, unknown>) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: { fetch: noStoreFetch },
      cookies: { get: () => undefined, set: () => {}, remove: () => {} },
    }
  )
}
