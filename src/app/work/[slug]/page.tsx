import { notFound } from 'next/navigation'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import { getProductsByTag } from '@/services/shopProductService'
import { getPublicRoutes } from '@/services/routeService'
import { getEventsByTag } from '@/services/eventService'
import { buildWorkFeed } from '@/lib/work/buildWorkFeed'
import WorkHomePage from '@/components/work/WorkHomePage'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WorkSlugPage({ params }: Props) {
  const { slug } = await params
  const tag = await getTagBySlug(slug)
  if (!tag) notFound()

  const [goods, shops, routes, events] = await Promise.all([
    getProductsByTag(tag.id),
    getShopsByTag(slug),
    getPublicRoutes({ tag: tag.name }),
    getEventsByTag(tag.id),
  ])

  // 새 소식(Feed) = 이벤트 + 새 입점 샵 최신순
  const feed = buildWorkFeed(events, shops)

  // 커뮤니티는 아직 미구현 — 빈 배열(연결 지점). 만드는 날 getPostsByTag(tag.id)로 교체
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
    />
  )
}
