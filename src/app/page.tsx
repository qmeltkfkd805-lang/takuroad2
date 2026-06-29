import { getShops } from '@/services/shopService'
import { getPublicRoutes } from '@/services/routeService'
import { getActiveWorks } from '@/services/activeWorksService'
import { getActiveBanners } from '@/services/featuredBannerService'
import HomeFeed from '@/components/home/HomeFeed'
import HomeRail from '@/components/home/HomeRail'
import HeroCarousel from '@/components/home/HeroCarousel'
import styles from '@/components/home/rail.module.css'

export default async function HomePage() {
  const [allShops, routes, activeWorks, banners] = await Promise.all([
    getShops(),
    getPublicRoutes(),
    getActiveWorks(6),
    getActiveBanners(),
  ])

  const popularShops = [...allShops]
    .sort((a, b) => (b.visit_count ?? 0) - (a.visit_count ?? 0))
    .slice(0, 6)

  return (
    <div className={styles.homeLayout}>
      <div>
        <HeroCarousel banners={banners} />
        <HomeFeed popularShops={popularShops} routes={(routes ?? []).slice(0, 5)} activeWorks={activeWorks} />
      </div>
      <HomeRail />
    </div>
  )
}
