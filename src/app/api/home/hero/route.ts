/* 홈 히어로 — 로그인한 사용자 기준 (최애 작품 이벤트를 앞으로)
   홈 페이지는 비로그인 기준 히어로로 미리 만들어 두고, 로그인 사용자만 화면이 뜬 뒤 이걸 불러 바꿔 낀다.
   공통 재료는 60초 캐시라 여기선 로그인 확인 + 최애 작품 목록만 새로 읽는다. */
import { NextResponse } from 'next/server'
import { getHeroSlots } from '@/services/heroService.server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const slots = await getHeroSlots()
    return NextResponse.json({ slots }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ slots: null }, { status: 500 })
  }
}
