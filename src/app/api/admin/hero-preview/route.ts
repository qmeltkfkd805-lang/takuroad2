import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeroSlots } from '@/services/heroService.server'

export const runtime = 'nodejs'

// 관리자 미리보기 — 실제 홈에 나갈 최종 히어로(수동+자동) 구성을 그대로 돌려준다
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  const cards = await getHeroSlots()
  return NextResponse.json({ cards })
}
