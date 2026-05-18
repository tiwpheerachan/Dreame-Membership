// ============================================================
// Admin debug: diagnose why a given order_sn isn't found in BigQuery.
//
// Returns:
//   - exact match result (with normalization), broken down by view
//   - fuzzy search: rows where order_sn LIKE '%input%' across both views
//   - env snapshot (project/dataset) so config drift is obvious
//
// ใช้เวลา user แจ้งว่า "ออเดอร์อยู่ใน BQ แต่ระบบบอก not found"
//   GET /api/admin/debug/bq-lookup?order_sn=XXXX
// ============================================================
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { verifyOrderInBQVerbose } from '@/lib/bigquery'

const PROJECT = process.env.BQ_PROJECT_ID ?? ''
const DATASET = process.env.BQ_DATASET ?? 'Membership'

function bqClient(): BigQuery {
  const credentialsJson = process.env.BQ_CREDENTIALS_JSON
  if (credentialsJson) {
    let parsed = credentialsJson
    try { JSON.parse(credentialsJson) } catch { parsed = Buffer.from(credentialsJson, 'base64').toString('utf-8') }
    return new BigQuery({ projectId: PROJECT, credentials: JSON.parse(parsed) })
  }
  return new BigQuery({ projectId: PROJECT })
}

async function fuzzyLookup(order_sn: string) {
  const bq = bqClient()
  const out: Record<string, { rows: unknown[]; error?: string }> = {}
  const param = `%${order_sn.trim().toUpperCase()}%`

  for (const view of ['order_items', 'orders']) {
    try {
      const [rows] = await bq.query({
        query: `
          SELECT DISTINCT
            order_sn,
            LENGTH(order_sn) AS sn_length,
            UPPER(TRIM(order_sn)) = UPPER(TRIM(@input)) AS exact_after_normalize
          FROM \`${PROJECT}.${DATASET}.${view}\`
          WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 24 MONTH)
            AND UPPER(TRIM(order_sn)) LIKE @param
          LIMIT 20
        `,
        params: { input: order_sn, param },
      })
      out[view] = { rows: rows ?? [] }
    } catch (e) {
      out[view] = { rows: [], error: (e as Error).message }
    }
  }
  return out
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const order_sn = new URL(req.url).searchParams.get('order_sn')
  if (!order_sn) return NextResponse.json({ error: 'order_sn required' }, { status: 400 })

  const exact = await verifyOrderInBQVerbose(order_sn)
  const fuzzy = await fuzzyLookup(order_sn)

  return NextResponse.json({
    env: {
      project: PROJECT || '(unset)',
      dataset: DATASET,
      has_credentials: Boolean(process.env.BQ_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS),
    },
    input: {
      raw: order_sn,
      trimmed: order_sn.trim(),
      normalized: order_sn.trim().toUpperCase(),
      length: order_sn.length,
    },
    exact_match: exact,
    fuzzy_match: fuzzy,
    hint:
      exact.status === 'found'
        ? 'พบใน BQ — ระบบควรขึ้น VERIFIED'
        : exact.status === 'error'
          ? 'Query fail — ดู env + credentials + attempted errors'
          : Object.values(fuzzy).some(v => (v.rows as { exact_after_normalize?: boolean }[]).some(r => r.exact_after_normalize))
            ? 'Fuzzy เจอแบบ normalize ตรง — ลองอัปเดต code เพิ่ม TRIM/UPPER (ทำแล้วใน latest deploy)'
            : Object.values(fuzzy).some(v => (v.rows as unknown[]).length > 0)
              ? 'Fuzzy เจอ order_sn ที่คล้าย — ดู rows ว่าต่างกันตรงไหน (ความยาว, ตัวอักษร, suffix)'
              : 'ไม่เจอจริงทั้ง exact และ fuzzy — ออเดอร์ยังไม่เข้า view (รอ sync) หรือ project/dataset ผิด',
  })
}
