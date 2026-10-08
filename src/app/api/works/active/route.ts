/* '지금 뜨는 작품' (최근 7일 검색·최애·관심 합산 상위 작품) — 10분마다 한 번만 DB에서 만들고, 그 사이엔 만들어 둔 걸 나눠 준다.
   누구에게나 같은 집계(작품 id·이름·slug)만 담는다. 개인 정보는 없다.
   화면마다 필요한 개수가 달라서 상위 ACTIVE_WORKS_MAX 개를 담아 두고, 받는 쪽(getActiveWorks)이 앞에서 잘라 쓴다. */
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { loadActiveWorks, ACTIVE_WORKS_MAX } from '@/services/activeWorksService'

export const revalidate = 600

const getCached = unstable_cache(() => loadActiveWorks(ACTIVE_WORKS_MAX), ['active-works-v1'], { revalidate: 600 })

export async function GET() {
  const items = await getCached()
  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } },
  )
}
