import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/routeRun/apiAuth'
import { recordManualCompletion } from '@/lib/routeRun/completion'

export const runtime = 'nodejs'

/* 비GPS 루트 완주 기록.
   본문은 { routeId } 만 받는다 — 사용자·검증 상태·EXP 는 전부 서버가 정한다.
   완주 조건(루트의 모든 샵이 route_progress 에 있는지)도 서버가 대조한다.
   EXP 는 0 이다. 보상은 GPS 세션이 검증한 완주에만 간다. */
export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }
  const extra = Object.keys(body as Record<string, unknown>).filter(k => k !== 'routeId')
  if (extra.length > 0) {
    return NextResponse.json({ error: `허용되지 않은 필드: ${extra.join(', ')}` }, { status: 400 })
  }
  const routeId = (body as { routeId?: unknown }).routeId
  if (typeof routeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(routeId)) {
    return NextResponse.json({ error: 'routeId 가 올바르지 않아요' }, { status: 400 })
  }

  const r = await recordManualCompletion(serviceClient(), user.id, routeId)
  if ('error' in r) {
    const status = r.error === 'not_completed' ? 409 : r.error === 'route_empty' ? 400 : 500
    return NextResponse.json({ error: r.error }, { status })
  }
  return NextResponse.json(r)
}
