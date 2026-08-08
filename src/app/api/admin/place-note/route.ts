import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// 관리자 전용 — 건물(place)의 '가는 길/출구 안내' 저장. admin 확인 후 Service Role로 RLS 우회.
export async function POST(request: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const { data: profile } = await userSupabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  const { placeId, accessNote } = await request.json()
  if (!placeId) return NextResponse.json({ error: 'placeId가 필요해요' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const value = typeof accessNote === 'string' && accessNote.trim() ? accessNote.trim() : null
  const { error } = await admin.from('places').update({ access_note: value } as any).eq('id', placeId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, access_note: value })
}
