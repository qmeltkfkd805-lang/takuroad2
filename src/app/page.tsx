import { getShops } from '@/services/shopService'
import { getPublicRoutes } from '@/services/routeService'
import { getActiveWorks } from '@/services/activeWorksService'
import { getActiveBanners } from '@/services/featuredBannerService'
import { getActiveEvents } from '@/services/eventService'
import { pickHotMap } from '@/lib/home/hotMap'
import HomeFeed from '@/components/home/HomeFeed'
import HomeRail from '@/components/home/HomeRail'
import HeroCarousel from '@/components/home/HeroCarousel'
import styles from '@/components/home/rail.module.css'

// 홈은 배너·이벤트·인기샵 등 실시간 Supabase 데이터를 쓰므로 항상 최신으로 렌더
export const dynamic = 'force-dynamic'

// 임시(제작중 등) 배너 제외
const isPlaceholderBanner = (b: any) =>
  /제작\s*중|사이트\s*제작|준비\s*중|테스트|공사/i.test(`${b?.title ?? ''} ${b?.subtitle ?? ''}`)

// 운영 배너가 없을 때 실제 추천 콘텐츠(루트·이벤트)로 히어로를 채운다 (임의 문구 하드코딩 X)
function buildFallbackHero(routes: any[], events: any[]) {
  const out: any[] = []
  const ranked = [...(routes ?? [])].sort(
    (a, b) => (b.is_official ? 1 : 0) - (a.is_official ? 1 : 0) || (b.likes ?? 0) - (a.likes ?? 0),
  )
  for (const r of ranked.slice(0, 2)) {
    if (!r.share_token) continue
    out.push({
      id: `route-${r.id}`,
      badge: '이번 주 추천',
      title: r.title,
      subtitle: (r.description && String(r.description).trim()) || `굿즈샵 ${r.route_shops?.length ?? 0}곳 코스`,
      image_url: r.cover_image_url ?? null,
      bg_color: '#20202D',
      text_color: '#ffffff',
      cta_label: '추천 루트 보기',
      cta_href: `/route/${r.share_token}`,
      cta_label2: '이벤트 들러보기',
      cta_href2: '/events',
    })
  }
  const ev = (events ?? [])[0]
  if (ev && out.length < 3) {
    out.push({
      id: `event-${ev.id}`,
      badge: '진행 중인 이벤트',
      title: ev.title ?? '이벤트',
      subtitle: ev.workName ?? ev.placeName ?? '',
      image_url: ev.coverUrl ?? null,
      bg_color: '#20202D',
      text_color: '#ffffff',
      cta_label: '이벤트 보기',
      cta_href: `/event/${ev.id}`,
    })
  }
  return out.slice(0, 3)
}

export default async function HomePage() {
  const [allShops, routes, activeWorks, banners, events] = await Promise.all([
    getShops(),
    getPublicRoutes(),
    getActiveWorks(10),
    getActiveBanners(),
    getActiveEvents(8),
  ])
  const popularShops = [...allShops]
    .sort((a, b) => (b.visit_count ?? 0) - (a.visit_count ?? 0))
    .slice(0, 6)
  const hotMap = pickHotMap(allShops)
  // 운영 배너(제작중 제외) 우선 → 없으면 실제 추천 루트/이벤트로 히어로 구성
  const realBanners = (banners ?? []).filter(b => !isPlaceholderBanner(b))
  const heroBanners = realBanners.length > 0 ? realBanners : buildFallbackHero(routes ?? [], events ?? [])
  return (
    <>
      <div className={styles.heroFull}>
        <HeroCarousel banners={heroBanners} />
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
