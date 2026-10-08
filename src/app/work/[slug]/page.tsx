export const dynamic = 'force-dynamic'

import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import { getProductsByTag } from '@/services/shopProductService'
import { getPublicRoutes } from '@/services/routeService'
import { getEventsByTag } from '@/services/eventService'
import { getFavoriteCount } from '@/services/workRelationshipService'
import { buildWorkFeed } from '@/lib/work/buildWorkFeed'
import WorkHomePage from '@/components/work/WorkHomePage'
import { pageMeta, toDescription } from '@/lib/seo/pageMeta'

// 메타데이터와 화면이 같은 작품을 두 번 읽지 않게 (한 요청 안에서 한 번만)
const getTag = cache((slug: string) => getTagBySlug(slug))

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
  const tag = await getTag(slug)
  if (!tag) notFound()

  const [goods, shops, routes, events, favoriteCount] = await Promise.all([
    getProductsByTag(tag.id),
    getShopsByTag(slug),
    getPublicRoutes({ tag: tag.name }),
    getEventsByTag(tag.id),
    getFavoriteCount(tag.id),
  ])

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
