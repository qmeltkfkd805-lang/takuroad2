import { notFound } from 'next/navigation'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import { getProductsByTag } from '@/services/shopProductService'
import { getPublicRoutes } from '@/services/routeService'
import { getEventsByTag } from '@/services/eventService'
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

  return <WorkHomePage tag={tag} goods={goods} shops={shops} routes={routes} events={events} />
}