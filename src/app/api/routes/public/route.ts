/* 공개 루트 전체 (루트 탐색·루트 목록·작품 화면에서 쓰는 getPublicRoutes 의 재료) — 60초마다 한 번만 DB에서 만들고, 그 사이엔 나눠 준다.
   예전엔 루트 화면을 열 때마다 사람마다 공개 루트 전부(경유 샵·태그 포함)를 DB에서 새로 읽었다 — DB 사용 시간 2위였다.
   공유된(is_shared) 루트의 공개 정보만 담는다. 저장 여부 같은 개인 정보는 각 화면이 따로 읽는다.
   지역·작품·검색어 거르기는 받는 쪽(getPublicRoutes)이 한다. */
import { NextResponse } from 'next/server'
import { loadPublicRoutes } from '@/services/routeService'

export const revalidate = 60

export async function GET() {
  const items = await loadPublicRoutes()
  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
