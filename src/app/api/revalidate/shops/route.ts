import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { purgeShopLists } from '@/lib/cache/shopListCache'

export const runtime = 'nodejs'

/* 샵 목록 캐시 비우기 — 샵 정보·사진·공개 상태를 바꾼 브라우저가 부른다 (shopService.refreshShopLists).
   로그인한 사람만. 캐시를 비우면 다음 요청 때 전체 샵을 DB에서 다시 받으므로(1MB+),
   여러 번 몰려도 30초에 한 번만 비운다(서버 인스턴스 기준). 늦어도 30분이면 어차피 새로 받는다. */
let lastPurge = 0
const MIN_GAP_MS = 30_000

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const now = Date.now()
  if (now - lastPurge < MIN_GAP_MS) return NextResponse.json({ purged: false, throttled: true })
  lastPurge = now
  purgeShopLists()
  return NextResponse.json({ purged: true })
}
