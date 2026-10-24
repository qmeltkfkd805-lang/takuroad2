import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { purgeEventPage } from '@/lib/cache/eventPageCache'
import { purgePlacePages } from '@/lib/cache/placePageCache'

export const runtime = 'nodejs'

/* 이벤트 상세 페이지 캐시 비우기 — 이벤트를 만들거나 고치거나 지운 브라우저가 부른다
   (eventDetailService.refreshEventPage). 로그인한 사람만, 이벤트 하나씩.
   장소 페이지의 '진행 중 이벤트'도 바뀔 수 있어서 장소 페이지도 같이 비운다. */
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!purgeEventPage(id)) return NextResponse.json({ error: '이벤트 id가 올바르지 않아요' }, { status: 400 })
  purgePlacePages()
  return NextResponse.json({ purged: true })
}
