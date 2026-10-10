/* 작품 전체 목록 (작품 탐색 화면 /my-works 의 재료) — 5분마다 한 번만 DB에서 만들고, 그 사이엔 만들어 둔 걸 나눠 준다.
   예전엔 작품 화면을 열 때마다 사람마다 작품 2,500여 개를 1,000개씩 세 번 이어서(로그인 확인 전·후로 두 번) DB에서 읽었다.
   카드·필터·정렬에 쓰는 칸만 담는다. 소개글·영어 이름은 '완성도 점수(score)'로만 넘긴다. 개인 정보(최애·관심)는 화면이 따로 읽는다. */
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getAllTags } from '@/services/shopService'

export const revalidate = 300

/** 추천순 = 완성도(이미지 우선) — 화면(MyWorksPage)의 예전 completeness 와 같은 계산 */
function score(w: any): number {
  let n = 0
  if (w.cover_url) n += 4
  if (w.banner_image) n += 3
  if (w.english_name) n++
  if (w.ip_type) n++
  if (w.release_year) n++
  if (w.description) n++
  if (w.genres && (Array.isArray(w.genres) ? w.genres.length > 0 : true)) n++
  return n
}

const getCached = unstable_cache(async () => {
  const all = await getAllTags()
  return all
    .map((w: any) => ({
      id: w.id, name: w.name, slug: w.slug,
      cover_url: w.cover_url ?? null, banner_image: w.banner_image ?? null,
      ip_type: w.ip_type ?? null, release_year: w.release_year ?? null, genres: w.genres ?? null,
      score: score(w),
    }))
    .sort((a, b) => (b.score - a.score) || String(a.name).localeCompare(String(b.name), 'ko'))
}, ['works-all-v1'], { revalidate: 300 })

export async function GET() {
  const items = await getCached()
  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } },
  )
}
