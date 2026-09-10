import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { evaluateBadgeTiersDetailed } from '@/services/badgeService'
import type { Database } from '@/types/database'

// 한 번에 병렬로 처리할 유저 수. 너무 크게 잡으면 DB 부하가 튀니 8 정도가 적당.
const BATCH = 8

// 보고에 실어 보낼 실패 건수 상한. 전부 실으면 응답이 무한정 커진다.
const MAX_REPORTED = 50

interface ExpFailure { userId: string; tierName: string; exp: number; message: string }
interface EvalFailure { userId: string; tierName: string; stage: string; message: string }

// 관리자 전용 — 모든 유저의 배지를 다시 평가해 새 배지를 소급 지급한다.
// (새 배지를 심었을 때 기존 유저에게도 주기 위함. 평소엔 활동할 때만 평가가 돈다.)
//
// ⚠️ 배지 지급과 보너스 EXP 지급은 원자적이지 않다. 배지만 들어가고 EXP 가 빠질 수 있다.
//    그 상태를 삼키지 않고 응답에 그대로 싣는다 — 관리자가 보고 다시 돌릴 수 있어야 한다.
//    보너스 EXP 는 (user, reason='badge', related_id=tier.id) 로 멱등하므로
//    재평가를 다시 돌려도 중복 지급되지 않고 빠진 것만 채워진다.
export async function POST() {
  // 1) 요청자가 로그인 + admin인지 확인 (일반 클라이언트, RLS 그대로)
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await userSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  // 2) Service Role로 전체 유저를 돌며 재평가 (RLS 우회 — 남의 user_badge_tiers에 INSERT 필요)
  //    ⭐ 이 클라이언트를 배지 지급뿐 아니라 보너스 EXP 지급까지 그대로 넘긴다.
  //       여기서 익명 클라이언트를 새로 만들면 grant_exp 가 42501 로 막힌다.
  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profiles, error } = await admin.from('profiles').select('id')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ids = (profiles ?? []).map(p => p.id)

  let usersProcessed = 0
  let totalGranted = 0
  let expGranted = 0
  let expFailed = 0
  const granted: { userId: string; count: number }[] = []
  const expFailures: ExpFailure[] = []
  const evalFailures: EvalFailure[] = []

  // 유저를 BATCH개씩 묶어 병렬 처리한다.
  // 한 명씩 직렬로 돌면 유저 수만큼 선형으로 느려지므로, 묶음 단위로 동시에 평가한다.
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH)
    const results = await Promise.all(
      slice.map(async (id) => {
        try {
          return { id, r: await evaluateBadgeTiersDetailed(id, admin), crashed: null as string | null }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.error('[배지 재평가 실패]', id, message)
          return { id, r: null, crashed: message }
        }
      })
    )

    for (const { id, r, crashed } of results) {
      usersProcessed++

      if (!r) {
        // 그 유저 평가가 통째로 터진 경우 — 조용히 넘기지 않는다
        if (evalFailures.length < MAX_REPORTED) {
          evalFailures.push({ userId: id, tierName: '-', stage: 'user', message: crashed ?? '알 수 없는 오류' })
        }
        continue
      }

      if (r.earned.length > 0) {
        totalGranted += r.earned.length
        granted.push({ userId: id, count: r.earned.length })
      }
      for (const o of r.earned) {
        if (o.exp <= 0) continue
        if (o.expGranted) {
          expGranted++
        } else {
          expFailed++
          if (expFailures.length < MAX_REPORTED) {
            expFailures.push({ userId: id, tierName: o.tierName, exp: o.exp, message: o.expError ?? '알 수 없는 오류' })
          }
        }
      }
      for (const f of r.failures) {
        if (evalFailures.length < MAX_REPORTED) {
          evalFailures.push({ userId: id, tierName: f.tierName, stage: f.stage, message: f.message })
        }
      }
    }
  }

  // 배지는 줬는데 EXP 가 빠졌거나 평가가 실패한 게 하나라도 있으면 부분 성공이다.
  const partial = expFailed > 0 || evalFailures.length > 0

  return NextResponse.json({
    success: true,
    partial,
    usersProcessed,
    totalGranted,
    expGranted,
    expFailed,
    evalFailedCount: evalFailures.length,
    granted,
    expFailures,
    evalFailures,
  })
}
