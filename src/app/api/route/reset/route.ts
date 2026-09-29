import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/routeRun/apiAuth'

export const runtime = 'nodejs'

/* 루트 "다시 도전" — 이 루트의 내 체크를 전부 푼다.
   POST { routeId }
   지우는 것 : 방문 체크(route_progress), 멈춰둔/진행 중 따라가기 세션(그 세션의 체크도 다시 안 뜨게 종료 처리)
   남기는 것 : 샵 방문 기록(check_ins), 완주 기록·완주 횟수, 경험치·배지, 완주 후기
   사용자는 서버가 세션에서 정한다(본문의 사용자 값은 받지 않음). */
export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const body = await req.json().catch(() => null) as any
  const routeId = body?.routeId
  if (typeof routeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(routeId)) {
    return NextResponse.json({ error: 'routeId 가 올바르지 않아요' }, { status: 400 })
  }

  const svc = serviceClient()
  const { error: pErr } = await svc.from('route_progress').delete().eq('route_id', routeId).eq('user_id', user.id)
  if (pErr) return NextResponse.json({ error: '초기화하지 못했어요' }, { status: 500 })

  // 이어하기로 남아 있던 따라가기 세션은 끝난 것으로 표시 → 다시 시작하면 빈 상태로 새 세션
  // (finalized_at 을 찍어 두면 종료 처리 코드가 나중에 진행·완주로 반영하지 않는다)
  const now = new Date().toISOString()
  const { error: sErr } = await svc.from('route_sessions')
    .update({ status: 'ended_partial', ended_at: now, finalized_at: now } as any)
    .eq('route_id', routeId).eq('user_id', user.id).in('status', ['active', 'paused'])
  if (sErr) console.error('[route reset] session', sErr.code, sErr.message)

  return NextResponse.json({ ok: true })
}
