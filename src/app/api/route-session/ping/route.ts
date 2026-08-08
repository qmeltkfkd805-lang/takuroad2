import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { fetchVerifyConfig } from '@/lib/routeRun/configServer'
import { processPing } from '@/lib/routeRun/sessionService'
import { requireUser } from '@/lib/routeRun/apiAuth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { sessionId, lat, lng, accuracy } = body
  if (!sessionId || typeof lat !== 'number' || typeof lng !== 'number') return NextResponse.json({ error: '입력 오류' }, { status: 400 })
  const acc = typeof accuracy === 'number' && accuracy > 0 ? accuracy : 9999

  const svc = serviceClient()
  const cfg = await fetchVerifyConfig(svc)
  const r = await processPing(svc, sessionId, user.id, { lat, lng, accuracy: acc }, cfg)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ confirmed: r.confirmed })
}
