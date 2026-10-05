import { unstable_cache } from 'next/cache'
import { getShops } from '@/services/shopService'
import { getPublicRoutes } from '@/services/routeService'
import { getActiveWorks } from '@/services/activeWorksService'
import { getActiveEvents } from '@/services/eventService'
import { getHeroSlots } from '@/services/heroService.server'
import { pickHotMap } from '@/lib/home/hotMap'
import { imagesFirst } from '@/lib/utils/shopOrder'
import { Shop } from '@/types/shop'
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
  // 덕질 지도(PC 오른쪽)로 넘기는 샵은 지도·목록에 쓰는 값만 — 소개글 같은 긴 글은 빼서 전송량을 줄인다
  const mapShops = imagesFirst(allShops).map(s => ({
    ...s,
    description: null, event_info: null, parking_note: null, temporary_holiday_message: null,
    images: s.images.slice(0, 1),
  })) as Shop[]
  return { popularShops, hotMap, mapShops }
}, ['home-shops-v1'], { revalidate: 60 })

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
        <HomeRail shops={shopData.mapShops} hotMap={shopData.hotMap} eventCount={events.length} />
      </div>
    </>
  )
}
