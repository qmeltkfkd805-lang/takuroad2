export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import { getProductsByTag } from '@/services/shopProductService'
import { getPublicRoutes } from '@/services/routeService'
import { getEventsByTag } from '@/services/eventService'
import { getFavoriteCount } from '@/services/workRelationshipService'
import { buildWorkFeed } from '@/lib/work/buildWorkFeed'
import WorkHomePage from '@/components/work/WorkHomePage'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WorkSlugPage({ params }: Props) {
  const { slug } = await params
  const tag = await getTagBySlug(slug)
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
