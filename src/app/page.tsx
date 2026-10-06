import { unstable_cache } from 'next/cache'
import { getShops } from '@/services/shopService'
import { getPublicRoutes } from '@/services/routeService'
import { getActiveWorks } from '@/services/activeWorksService'
import { getActiveEvents } from '@/services/eventService'
import { getHeroSlots } from '@/services/heroService.server'
import { pickHotMap } from '@/lib/home/hotMap'
import { imagesFirst } from '@/lib/utils/shopOrder'
import HomeFeed from '@/components/home/HomeFeed'
import HomeRail from '@/components/home/HomeRail'
import HeroCarousel from '@/components/home/HeroCarousel'
import styles from '@/components/home/rail.module.css'

// 홈은 히어로가 로그인 사용자(관심 작품)에 따라 달라서 요청마다 렌더한다.
export const dynamic = 'force-dynamic'

/* ⚡ 홈 로딩 속도 — 누구에게나 같은 공개 데이터(샵·루트·작품·이벤트)는 60초 동안 캐시해 둔다.
   예전에는 홈을 열 때마다 전체 샵 + 전체 루트(샵·태그 포함)를 DB에서 새로 읽어서 느렸다.
   히어로(getHeroSlots)만 사용자별이라 매번 읽는다. */
const getHomeShopData = unstable_cache(async () => {
  const allShops = await getShops()
  // 인기 샵: 사진 있는 샵 먼저 → 방문 많은 순
  const popularShops = imagesFirst([...allShops].sort((a, b) => (b.visit_count ?? 0) - (a.visit_count ?? 0))).slice(0, 6)
  const hotMap = pickHotMap(allShops)
  // 덕질 지도(PC 오른쪽)의 샵 목록은 홈 서버 응답에 싣지 않는다 — HomeRail 이 화면이 뜬 뒤 PC에서만 따로 가져온다.
  // (예전엔 전체 샵 정보를 실어 보내서 홈 응답이 1.3MB를 넘었고, 그래서 화면이 늦게 떴다)
  return { popularShops, hotMap }
}, ['home-shops-v2'], { revalidate: 60 })

const getHomeRoutes = unstable_cache(async () => ((await getPublicRoutes()) ?? []).slice(0, 5), ['home-routes-v1'], { revalidate: 60 })
const getHomeWorks = unstable_cache(() => getActiveWorks(10), ['home-works-v1'], { revalidate: 60 })
const getHomeEvents = unstable_cache(() => getActiveEvents(8), ['home-events-v1'], { revalidate: 60 })

export default async function HomePage() {
  const [shopData, routes, activeWorks, hero, events] = await Promise.all([
    getHomeShopData(),
    getHomeRoutes(),
    getHomeWorks(),
    getHeroSlots(),          // 홈 히어로: 수동 슬롯 우선 + 시작예정 이벤트 자동 채움 (최대 5)
    getHomeEvents(),
  ])
  return (
    <>
      <div className={styles.heroFull}>
        <HeroCarousel slots={hero} />
      </div>
      <div className={styles.homeLayout}>
        <div>
          <HomeFeed popularShops={shopData.popularShops} routes={routes} activeWorks={activeWorks} events={events} />
        </div>
        <HomeRail hotMap={shopData.hotMap} eventCount={events.length} />
      </div>
    </>
  )
}
