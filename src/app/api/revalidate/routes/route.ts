import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { purgeRoutePages } from '@/lib/cache/routePageCache'

export const runtime = 'nodejs'

/* 루트 상세 페이지 캐시 비우기 — 루트를 저장·공개 전환·삭제한 브라우저가 부른다
   (routeService.refreshRoutePages). 로그인한 사람만. */
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  purgeRoutePages()
  return NextResponse.json({ purged: true })
}
