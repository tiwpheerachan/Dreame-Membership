import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Lightweight readiness probe — verifies the app can talk to its database.
// Hook this up to your uptime monitor (UptimeRobot, BetterStack, Render
// health check, etc.) so you find out before users do when something breaks.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const start = Date.now()
  try {
    const supabase = createServiceClient()
    // Use a HEAD count query — cheap and doesn't return rows
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true }).limit(1)
    const latency = Date.now() - start
    if (error) {
      return NextResponse.json(
        { status: 'degraded', error: error.message, db_latency_ms: latency },
        { status: 503 },
      )
    }
    return NextResponse.json({
      status: 'ok',
      db_latency_ms: latency,
      ts: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { status: 'down', error: e instanceof Error ? e.message : 'unknown' },
      { status: 503 },
    )
  }
}
