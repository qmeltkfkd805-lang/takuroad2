import { getShops } from '@/services/shopService'
import { getPublicRoutes } from '@/services/routeService'
import { getActiveWorks } from '@/services/activeWorksService'
import { getActiveEvents } from '@/services/eventService'
import { getHeroSlots } from '@/services/heroService.server'
import { pickHotMap } from '@/lib/home/hotMap'
import HomeFeed from '@/components/home/HomeFeed'
import HomeRail from '@/components/home/HomeRail'
import HeroCarousel from '@/components/home/HeroCarousel'
import styles from '@/components/home/rail.module.css'

// 홈은 배너·이벤트·인기샵 등 실시간 Supabase 데이터를 쓰므로 항상 최신으로 렌더
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [allShops, routes, activeWorks, hero, events] = await Promise.all([
    getShops(),
    getPublicRoutes(),
    getActiveWorks(10),
    getHeroSlots(),          // 홈 히어로: 수동 슬롯 우선 + 시작예정 이벤트 자동 채움 (최대 5)
    getActiveEvents(8),
  ])
  const popularShops = [...allShops]
    .sort((a, b) => (b.visit_count ?? 0) - (a.visit_count ?? 0))
    .slice(0, 6)
  const hotMap = pickHotMap(allShops)
  return (
    <>
      <div className={styles.heroFull}>
        <HeroCarousel slots={hero} />
      </div>
      <div className={styles.homeLayout}>
        <div>
          <HomeFeed popularShops={popularShops} routes={(routes ?? []).slice(0, 5)} activeWorks={activeWorks} events={events} />
        </div>
        <HomeRail shops={allShops} hotMap={hotMap} eventCount={events.length} />
      </div>
    </>
  )
}
