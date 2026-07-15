import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { evaluateBadgeTiersForUser } from '@/services/badgeService'
import type { Database } from '@/types/database'

// 한 번에 병렬로 처리할 유저 수. 너무 크게 잡으면 DB 부하가 튀니 8 정도가 적당.
const BATCH = 8

// 관리자 전용 — 모든 유저의 배지를 다시 평가해 새 배지를 소급 지급한다.
// (새 배지를 심었을 때 기존 유저에게도 주기 위함. 평소엔 활동할 때만 평가가 돈다.)
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
  const granted: { userId: string; count: number }[] = []

  // 유저를 BATCH개씩 묶어 병렬 처리한다.
  // 한 명씩 직렬로 돌면 유저 수만큼 선형으로 느려지므로, 묶음 단위로 동시에 평가한다.
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH)
    const results = await Promise.all(
      slice.map(async (id) => {
        try {
          const newly = await evaluateBadgeTiersForUser(id, admin)
          return { id, count: newly.length }
        } catch (e: any) {
          console.error('[배지 재평가 실패]', id, e?.message)
          return { id, count: 0 }
        }
      })
    )
    for (const r of results) {
      usersProcessed++
      if (r.count > 0) {
        totalGranted += r.count
        granted.push({ userId: r.id, count: r.count })
      }
    }
  }

  return NextResponse.json({ success: true, usersProcessed, totalGranted, granted })
}