import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateBadgeTiersDetailed } from '@/services/badgeService'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

/* ============================================================
   자동 배지 평가 — 본인 것만

   ⚠️ 요청 본문을 받지 않는다. 평가 대상은 세션 사용자 고정이다.
      userId 를 받는 순간 남의 배지를 평가시킬 수 있고,
      "서버가 조건을 계산한다"는 전제가 무너진다.
      지급할 badge_tier_id 도 서버가 정한다 — 클라이언트는 지정할 수 없다.

   관리자의 전체 재평가는 /api/admin/reevaluate-badges 로 따로 간다
   (그쪽은 profiles.role='admin' 을 서버에서 확인한다).

   응답에는 실패 사유 문자열을 그대로 싣지 않는다. 서버 로그로만 남긴다.
   ============================================================ */

export async function POST() {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const r = await evaluateBadgeTiersDetailed(user.id, admin)

    if (r.expFailures.length > 0 || r.failures.length > 0) {
      // 부분 실패는 삼키지 않는다. 다만 사용자에게 내부 메시지를 노출하지는 않는다.
      console.error('[badges/evaluate] 부분 실패', {
        userId: user.id,
        expFailures: r.expFailures.map(o => ({ tier: o.tierName, message: o.expError })),
        failures: r.failures,
      })
    }

    return NextResponse.json({
      newTierIds: r.earned.map(o => o.tierId),
      newTiers: r.earned.map(o => ({ id: o.tierId, name: o.tierName })),
      partial: r.expFailures.length > 0 || r.failures.length > 0,
    })
  } catch (e) {
    console.error('[badges/evaluate] 실패', user.id, e)
    return NextResponse.json({ error: '배지 평가에 실패했어요' }, { status: 500 })
  }
}
