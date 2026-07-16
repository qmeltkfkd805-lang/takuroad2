import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

// 관리자 전용 — 특정 유저에게 수동 배지(창립멤버·베타테스터·한정판 등)를 지급한다.
export async function POST(req: Request) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await userSupabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const userId = body?.userId as string | undefined
  const tierId = body?.tierId as string | undefined
  if (!userId || !tierId) {
    return NextResponse.json({ error: 'userId·tierId가 필요해요' }, { status: 400 })
  }

  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await admin
    .from('user_badge_tiers')
    .select('user_id')
    .eq('user_id', userId).eq('badge_tier_id', tierId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: '이미 이 배지를 보유한 유저예요' }, { status: 409 })
  }

  const { error } = await admin
    .from('user_badge_tiers')
    .insert({ user_id: userId, badge_tier_id: tierId, awarded_by: user.id } as any)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 배지 이름 조회 후 알림 생성 (best-effort — 실패해도 지급은 성공 처리)
  const { data: tier } = await admin
    .from('badge_tiers').select('name').eq('id', tierId).maybeSingle()
  const badgeName = (tier as any)?.name ?? '새 배지'
  const { error: notiErr } = await admin.from('notifications').insert({
    user_id: userId,
    type: 'badge',
    title: '새 배지 획득',
    body: badgeName + ' 배지를 받았어요!',
    link: '/cosmetic',
    related_type: 'badge_tier',
    related_id: tierId,
  } as any)

  return NextResponse.json({ success: true, notified: !notiErr, notiError: notiErr?.message ?? null })
}