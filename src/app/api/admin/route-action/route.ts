import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// 관리자 전용 루트 관리 (삭제 / 공개·비공개). 요청자가 admin인지 확인 후 Service Role로 RLS 우회.
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

  const { routeId, action, shared } = await request.json()
  if (!routeId || !action) return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

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
