export const dynamic = 'force-dynamic'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import { getProductsByTag } from '@/services/shopProductService'
import { loadPublicRoutes, filterPublicRoutes } from '@/services/routeService'
import { getEventsByTag } from '@/services/eventService'
import { getFavoriteCount } from '@/services/workRelationshipService'
import { buildWorkFeed } from '@/lib/work/buildWorkFeed'
import WorkHomePage from '@/components/work/WorkHomePage'
import { pageMeta, toDescription } from '@/lib/seo/pageMeta'

/* ⚡ 작품 페이지 재료는 작품마다 2분 동안 만들어 둔 걸 쓴다 (누가 보든 같은 공개 정보 — 로그인별 정보는 화면이 따로 읽는다).
   예전엔 열 때마다 작품·굿즈·샵·이벤트·좋아요 수를 DB에서 새로 읽고, 샵은 소개글·SNS·영업시간까지 전부 실어 보내서
   치이카와 기준 화면 응답이 약 590KB, 1초 가까이 걸렸다 ('불러오는 중'이 오래 보이던 이유). 카드에 쓰는 칸만 남긴다. */
const getTag = cache((slug: string) => getWorkCached(slug).then(d => d.tag))

/** 샵 카드(ShopCard)·새 소식(buildWorkFeed)이 읽는 칸만 */
function slimWorkShop(s: any) {
  return {
    id: s.id, slug: s.slug, name: s.name,
    region: s.region, city: s.city, district: s.district,
    cats: s.cats ?? [], images: (s.images ?? []).slice(0, 1),
    is_verified: s.is_verified, rating_avg: s.rating_avg, rating_count: s.rating_count,
    created_at: s.created_at,
  }
}
/** 루트 카드가 읽는 칸만 (경유 샵은 개수만 필요) */
function slimWorkRoute(r: any) {
  return {
    id: r.id, title: r.title, description: r.description ?? null, share_token: r.share_token,
    total_distance_m: r.total_distance_m, total_duration_min: r.total_duration_min,
    route_shops: (r.route_shops ?? []).map((rs: any) => ({ id: rs.id })),
  }
}

const getWorkCached = cache((slug: string) => unstable_cache(async () => {
  const tag = await getTagBySlug(slug)
  if (!tag) return { tag: null, goods: [], shops: [], routes: [], events: [], favoriteCount: 0 }
  const [goods, shops, routes, events, favoriteCount] = await Promise.all([
    getProductsByTag(tag.id),
    getShopsByTag(slug),
    getAllPublicRoutes().then(all => filterPublicRoutes(all, { tag: tag.name })),
    getEventsByTag(tag.id),
    getFavoriteCount(tag.id),
  ])
  return {
    tag, goods, events, favoriteCount,
    shops: (shops ?? []).map(slimWorkShop),
    routes: (routes ?? []).map(slimWorkRoute),
  }
}, ['work-page-v1', slug], { revalidate: 120 })())

/* ⚡ 공개 루트 전체는 60초 동안 모든 작품 페이지가 같이 쓴다.
   예전엔 작품 페이지를 열 때마다(검색엔진이 2,500개 작품을 훑을 때도) 공개 루트 전부를 경유 샵·태그까지 DB에서 새로 읽었다
   — 10/9 기준 DB 사용 시간 1위(3,518회 · 평균 27ms). 작품별 거르기는 그 뒤에 여기서 한다. */
const getAllPublicRoutes = unstable_cache(() => loadPublicRoutes(), ['public-routes-all-v1'], { revalidate: 60 })

interface Props {
  params: Promise<{ slug: string }>
}

/* 작품 페이지 검색·공유 정보 — 예전엔 2,500개 작품 페이지가 전부 같은 제목('타쿠로드 | 덕후의 성지순례 지도')이었다 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTag(slug)
  if (!tag) return { title: '작품을 찾을 수 없어요', robots: { index: false, follow: true } }
  const t = tag as any
  const name: string = t.name
  const alt = t.english_name && t.english_name !== name ? ` (${t.english_name})` : ''
  const description = toDescription(t.description)
    || `${name}${alt} 굿즈샵·팝업스토어·콜라보 카페·이벤트를 지도에서 찾아보세요. 타쿠로드에서 ${name} 성지순례 정보를 한눈에.`
  return pageMeta({
    title: `${name} 굿즈샵·팝업·이벤트`,
    description,
    path: `/work/${encodeURIComponent(slug)}`,
    image: t.banner_image || t.cover_url,
  })
}

export default async function WorkSlugPage({ params }: Props) {
  const { slug } = await params
  const { tag, goods, shops, routes, events, favoriteCount } = await getWorkCached(slug)
  if (!tag) notFound()

  const feed = buildWorkFeed(events, shops)
  const communityPosts: any[] = []

  return (
    <WorkHomePage
      tag={tag}
      feed={feed}
      events={events}
      shops={shops}
      goods={goods}
      routes={routes}
      communityPosts={communityPosts}
      favoriteCount={favoriteCount}
    />
  )
}
