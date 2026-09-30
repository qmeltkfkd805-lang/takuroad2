import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// 관리자 전용 루트 관리 (삭제 / 공개·비공개 / 작성자 넘기기). 요청자가 admin인지 확인 후 Service Role로 RLS 우회.
export async function POST(request: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const { data: profile } = await userSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  const { routeId, action, shared, targetUserId, query } = await request.json()
  if (!action || (action !== 'findUser' && !routeId)) return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 작성자 넘기기용 회원 찾기 (닉네임 일부로)
  if (action === 'findUser') {
    const q = String(query ?? '').trim().replace(/[%_,()]/g, '')
    if (q.length < 1) return NextResponse.json({ users: [] })
    const { data, error } = await admin.from('profiles').select('id, nickname, avatar_url').ilike('nickname', `%${q}%`).limit(10)
    if (error) {
      // avatar_url 칸이 없을 때도 동작하게
      const { data: d2, error: e2 } = await admin.from('profiles').select('id, nickname').ilike('nickname', `%${q}%`).limit(10)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json({ users: d2 ?? [] })
    }
    return NextResponse.json({ users: data ?? [] })
  }

  if (action === 'transferOwner') {
    // 출처 주인이 가입하면 루트를 그분 이름으로 넘긴다 — 이전 작성자는 transferred_from 에 남김
    if (!targetUserId) return NextResponse.json({ error: '넘길 회원을 골라주세요' }, { status: 400 })
    const { data: target } = await admin.from('profiles').select('id, nickname').eq('id', targetUserId).maybeSingle()
    if (!target) return NextResponse.json({ error: '회원을 찾지 못했어요' }, { status: 404 })
    const { data: cur } = await admin.from('routes').select('user_id').eq('id', routeId).maybeSingle()
    if (!cur) return NextResponse.json({ error: '루트를 찾지 못했어요' }, { status: 404 })
    if (cur.user_id === targetUserId) return NextResponse.json({ error: '이미 이 회원의 루트예요' }, { status: 400 })
    let { error } = await admin.from('routes')
      .update({ user_id: targetUserId, transferred_from: cur.user_id, transferred_at: new Date().toISOString() })
      .eq('id', routeId)
    if (error && /transferred_/.test(error.message)) {
      // 아직 migrations/route_transfer.sql 을 안 돌렸으면 작성자만 바꾼다
      ;({ error } = await admin.from('routes').update({ user_id: targetUserId }).eq('id', routeId))
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, nickname: target.nickname })
  }

  if (action === 'delete') {
    const { error } = await admin.from('routes').delete().eq('id', routeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === 'setShared') {
    const { error } = await admin.from('routes').update({ is_shared: !!shared }).eq('id', routeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
