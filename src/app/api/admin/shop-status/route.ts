import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  // 1. 요청한 사람이 로그인했는지 + admin인지 확인 (일반 클라이언트로, RLS 그대로 적용)
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

  // 2. admin 확인됐으면, Service Role로 실제 업데이트 수행 (RLS 우회)
  const { shopId, status, reason } = await request.json()

  if (!shopId || !status) {
    return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const payload: any = { status }
  if (status === 'deleted') {
    payload.deleted_at = new Date().toISOString()
    payload.deleted_by = user.id
    payload.delete_reason = reason ?? null
  }

  const { error } = await adminSupabase
    .from('shops')
    .update(payload)
    .eq('id', shopId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}