// ============================================================
// Admin health: probes ALL critical external services (admin-only)
//   - Supabase database (HEAD count)
//   - BigQuery (list datasets — auth check only, cheap)
//   - Resend (validate API key + sender domain)
//   - SMS hook (ping our Supabase Edge Function with empty body — must
//     reject with 401 invalid signature, proving it's deployed)
// ============================================================
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Probe = {
  name: string
  status: 'ok' | 'degraded' | 'down' | 'unknown'
  ms?: number
  detail?: string
}

async function probeDb(): Promise<Probe> {
  const t0 = Date.now()
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true }).limit(1)
    const ms = Date.now() - t0
    if (error) return { name: 'Database (Supabase)', status: 'down', ms, detail: error.message }
    return { name: 'Database (Supabase)', status: 'ok', ms, detail: `connected · ${ms}ms` }
  } catch (e) {
    return { name: 'Database (Supabase)', status: 'down', detail: (e as Error).message }
  }
}

async function probeBigQuery(): Promise<Probe> {
  const t0 = Date.now()
  try {
    const proj = process.env.BQ_PROJECT_ID
    if (!proj) return { name: 'BigQuery', status: 'unknown', detail: 'BQ_PROJECT_ID not set' }
    const { BigQuery } = await import('@google-cloud/bigquery')
    const credentialsJson = process.env.BQ_CREDENTIALS_JSON
    let client: InstanceType<typeof BigQuery>
    if (credentialsJson) {
      let parsed = credentialsJson
      try { JSON.parse(credentialsJson) } catch { parsed = Buffer.from(credentialsJson, 'base64').toString('utf-8') }
      client = new BigQuery({ projectId: proj, credentials: JSON.parse(parsed) })
    } else {
      client = new BigQuery({ projectId: proj })
    }
    // List datasets is the lightest auth check
    const [datasets] = await client.getDatasets({ maxResults: 1 })
    const ms = Date.now() - t0
    return { name: 'BigQuery', status: 'ok', ms, detail: `connected · พบ ${datasets.length}+ datasets` }
  } catch (e) {
    return { name: 'BigQuery', status: 'down', ms: Date.now() - t0, detail: (e as Error).message.slice(0, 120) }
  }
}

async function probeResend(): Promise<Probe> {
  const t0 = Date.now()
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return { name: 'Email (Resend)', status: 'unknown', detail: 'RESEND_API_KEY not set' }
    const r = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const ms = Date.now() - t0
    if (!r.ok) return { name: 'Email (Resend)', status: 'down', ms, detail: `HTTP ${r.status}` }
    const j = await r.json() as { data?: Array<{ status: string; name: string }> }
    const verified = (j.data || []).filter(d => d.status === 'verified')
    return {
      name: 'Email (Resend)',
      status: verified.length > 0 ? 'ok' : 'degraded',
      ms,
      detail: verified.length > 0
        ? `API ok · ${verified.length} verified domain (${verified[0].name})`
        : 'API ok แต่ยังไม่มี verified domain',
    }
  } catch (e) {
    return { name: 'Email (Resend)', status: 'down', ms: Date.now() - t0, detail: (e as Error).message }
  }
}

async function probeSmsHook(): Promise<Probe> {
  const t0 = Date.now()
  try {
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!projectUrl) return { name: 'SMS Hook (Edge Function)', status: 'unknown', detail: 'SUPABASE_URL not set' }
    // Ping with empty body — function should reject with 401 (signature missing)
    // 401 = function is deployed and signing logic works
    // 404 = function not deployed
    // 5xx = function errored
    const r = await fetch(`${projectUrl}/functions/v1/send-sms-hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const ms = Date.now() - t0
    if (r.status === 401) {
      return { name: 'SMS Hook (Edge Function)', status: 'ok', ms, detail: 'deployed · signature check active' }
    }
    if (r.status === 404) {
      return { name: 'SMS Hook (Edge Function)', status: 'down', ms, detail: 'function ไม่ deploy' }
    }
    return { name: 'SMS Hook (Edge Function)', status: 'degraded', ms, detail: `HTTP ${r.status} (คาดไว้ 401)` }
  } catch (e) {
    return { name: 'SMS Hook (Edge Function)', status: 'down', ms: Date.now() - t0, detail: (e as Error).message }
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const probes = await Promise.all([
    probeDb(),
    probeBigQuery(),
    probeResend(),
    probeSmsHook(),
  ])

  return NextResponse.json({ probes, ts: new Date().toISOString() })
}
