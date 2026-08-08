import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { fetchVerifyConfig } from '@/lib/routeRun/configServer'
import { endSession } from '@/lib/routeRun/sessionService'
import { requireUser } from '@/lib/routeRun/apiAuth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const { sessionId, mode, manualShopIds } = await req.json().catch(() => ({}))
  if (!sessionId || !['complete', 'partial', 'later'].includes(mode)) return NextResponse.json({ error: '입력 오류' }, { status: 400 })
  const manual = Array.isArray(manualShopIds) ? manualShopIds.filter((x: any) => typeof x === 'string') : []

  const svc = serviceClient()
  const cfg = await fetchVerifyConfig(svc)
  const r = await endSession(svc, sessionId, user.id, mode, manual, cfg)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json(r)
}
