import { getShops } from '@/services/shopService'
import { getPublicRoutes } from '@/services/routeService'
import HomeFeed from '@/components/home/HomeFeed'

export default async function HomePage() {
  const [allShops, routes] = await Promise.all([
    getShops(),
    getPublicRoutes(),
  ])

  const popularShops = [...allShops]
    .sort((a, b) => (b.visit_count ?? 0) - (a.visit_count ?? 0))
    .slice(0, 6)

  return <HomeFeed popularShops={popularShops} routes={(routes ?? []).slice(0, 5)} />
}