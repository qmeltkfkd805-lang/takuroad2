import { shopRegion, shopDistrict } from '@/lib/utils/region'
import { getShopStatus } from '@/lib/utils/shopStatus'
import { ShopHomeItem, hotScore } from '@/services/shopHomeService'
import { CATEGORIES } from '@/lib/constants/categories'

const CAT_BY_SLUG: Record<string, string> =
  Object.fromEntries(CATEGORIES.map(c => [c.slug, c.name]))

/** 샵 홈 필터 상태 — 전부 URL 쿼리로 직렬화 가능한 원시값 */
export interface ShopFilters {
  region: string | null          // "서울" (시/도)
  district: string | null        // "마포구"
  workSlugs: string[]            // 취급 작품 (복수, AND)
  cats: string[]                 // 샵 종류 (복수, OR)
  goodsSlugs: string[]           // 취급 굿즈 (복수, AND)
  openNow: boolean               // 영업중만
  excludeClosedToday: boolean    // 오늘 휴무 제외
  hasEvent: boolean              // 이벤트 진행중
  official: boolean              // 공식 인증샵 (정보 확인 or 사장님 인증)
  featured: boolean              // 운영자 추천
  mine: 'favorite' | 'library' | 'saved' | null  // 내 취향
  sort: 'hot' | 'reviews' | 'saves' | 'recent'
}

export const EMPTY_FILTERS: ShopFilters = {
  region: null, district: null,
  workSlugs: [], cats: [], goodsSlugs: [],
  openNow: false, excludeClosedToday: false, hasEvent: false,
  official: false, featured: false,
  mine: null, sort: 'hot',
}

/** 내 취향 필터에 필요한 사용자 데이터 (없으면 그 필터는 무시) */
export interface UserContext {
  favoriteTagIds: Set<string>
  libraryTagIds: Set<string>
  savedShopIds: Set<string>
}

const EMPTY_USER: UserContext = {
  favoriteTagIds: new Set(), libraryTagIds: new Set(), savedShopIds: new Set(),
}

/** 하나라도 켜진 필터가 있는가 (초기화 버튼 노출용) */
export function isDirty(f: ShopFilters): boolean {
  return !!(
    f.region || f.district || f.workSlugs.length || f.cats.length || f.goodsSlugs.length ||
    f.openNow || f.excludeClosedToday || f.hasEvent ||
    f.official || f.featured || f.mine
  )
}

export function applyShopFilters(
  items: ShopHomeItem[],
  f: ShopFilters,
  user: UserContext = EMPTY_USER,
  now = new Date(),
): ShopHomeItem[] {
  const rows = items.filter(s => {
    // 위치
    if (f.region && shopRegion(s) !== f.region) return false
    if (f.district && shopDistrict(s) !== f.district) return false

    // 취급 작품 — 고른 작품을 전부 다뤄야 함 (AND)
    if (f.workSlugs.length) {
      const slugs = new Set(s.works.map(w => w.slug))
      if (!f.workSlugs.every(w => slugs.has(w))) return false
    }

    // 샵 종류 — 고른 종류를 전부 가진 샵만 (AND)
    if (f.cats.length) {
      const catSet = new Set(s.cats)
      if (!f.cats.every(c => catSet.has(c))) return false
    }

    // 취급 분야 — 고른 것 중 하나라도 취급하면 (OR)
    if (f.goodsSlugs.length) {
      const gset = new Set(s.goodsSlugs)
      if (!f.goodsSlugs.some(g => gset.has(g))) return false
    }

    // 운영 상태
    if (f.openNow || f.excludeClosedToday) {
      const st = getShopStatus(s, now)
      // 영업중 = 영업중 + 곧 마감 (둘 다 지금 문 열려 있음)
      const isOpen = st.kind === 'open' || st.kind === 'closing_soon'
      if (f.openNow && !isOpen) return false
      if (f.excludeClosedToday && st.kind === 'dayoff') return false
    }

    if (f.hasEvent && !s.hasEvent) return false
    if (f.official && !(s.is_verified || s.is_claimed)) return false
    if (f.featured && s.featured_order == null) return false

    // 내 취향
    if (f.mine === 'favorite' && !s.works.some(w => user.favoriteTagIds.has(w.id))) return false
    if (f.mine === 'library' && !s.works.some(w => user.libraryTagIds.has(w.id))) return false
    if (f.mine === 'saved' && !user.savedShopIds.has(s.id)) return false

    return true
  })

  // 정렬
  const sorted = [...rows]
  switch (f.sort) {
    case 'reviews': sorted.sort((a, b) => b.rating_count - a.rating_count); break
    case 'saves':   sorted.sort((a, b) => b.bookmark_count - a.bookmark_count); break
    case 'recent':  sorted.sort((a, b) => b.created_at.localeCompare(a.created_at)); break
    default:        sorted.sort((a, b) => hotScore(b) - hotScore(a))
  }
  return sorted
}

/* ───────── 프리셋 : "오늘 뭐 사러 갈까?" ───────── */

export interface ShopPreset {
  id: string
  label: string
  icon: string        // EventIconName
  color: string
  patch: Partial<ShopFilters>
  /** 누르면 열 탭. 팝업·전시·콜라보 카페는 샵이 아니라 이벤트라 'event' 탭으로 연다 */
  tab?: 'shop' | 'event'
}

/**
 * 거리(5km)는 프리셋에서 뺐다 — 샵 홈엔 위치 권한이 없다.
 * 위치 기반 프리셋은 지도의 몫.
 */
export const SHOP_PRESETS: ShopPreset[] = [
  { id: 'figure', label: '피규어 쇼핑', icon: 'bag',    color: '#E8006F', patch: { goodsSlugs: ['figure-new'], openNow: true } },
  { id: 'gacha',  label: '가챠 투어',   icon: 'sparkle', color: '#E03535', patch: { goodsSlugs: ['gacha-new'], openNow: true } },
  // 아래 3개는 샵이 아니라 기간 한정 이벤트 → '팝업·이벤트' 탭이 열린 상태로 보여준다
  { id: 'cafe',   label: '콜라보 카페', icon: 'party',  color: '#EA580C', patch: { cats: ['콜라보카페'] }, tab: 'event' },
  { id: 'exhibition', label: '전시회', icon: 'star', color: '#4F46E5', patch: { cats: ['전시'] }, tab: 'event' },
  { id: 'popup',  label: '이번 주 팝업', icon: 'ticket', color: '#0099CC', patch: { cats: ['팝업스토어'] }, tab: 'event' },
]

/** URL 쿼리 ↔ 필터 */
export function filtersToParams(f: ShopFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.region) p.set('region', f.region)
  if (f.district) p.set('district', f.district)
  if (f.workSlugs.length) p.set('works', f.workSlugs.join(','))
  if (f.cats.length) p.set('cats', f.cats.join(','))
  if (f.goodsSlugs.length) p.set('goods', f.goodsSlugs.join(','))
  if (f.openNow) p.set('open', '1')
  if (f.excludeClosedToday) p.set('notclosed', '1')
  if (f.hasEvent) p.set('event', '1')
  if (f.official) p.set('official', '1')
  if (f.featured) p.set('featured', '1')
  if (f.mine) p.set('mine', f.mine)
  if (f.sort !== 'hot') p.set('sort', f.sort)
  return p
}

export function paramsToFilters(p: URLSearchParams): ShopFilters {
  const list = (k: string) => { const v = p.get(k); return v ? v.split(',').filter(Boolean) : [] }
  const mine = p.get('mine')
  const sort = p.get('sort')

  // 샵 홈 타일·섹션·지역·작품 링크에서 넘어오는 파라미터 흡수
  const catFromTile = p.get('cat')       // ?cat=goods
  const section = p.get('section')       // ?section=hot|new|event|featured|favorite
  const regionCombo = p.get('region')    // 샵 홈 지역카드는 "서울 마포구" 형태로 보냄
  const workSlug = p.get('work')         // 최애 취급샵 → 단일 작품 슬러그

  // region 값이 "서울 마포구"면 시/도와 구로 나눈다
  let regionVal = p.get('region')
  let districtVal = p.get('district')
  if (regionCombo && regionCombo.includes(' ')) {
    const parts = regionCombo.split(' ')
    regionVal = parts[0]
    districtVal = parts.slice(1).join(' ')
  }

  const workList = list('works')
  if (workSlug && !workList.includes(workSlug)) workList.push(workSlug)

  const base = {
    region: regionVal,
    district: districtVal,
    workSlugs: workList,
    cats: list('cats'),
    goodsSlugs: list('goods'),
    openNow: p.get('open') === '1',
    excludeClosedToday: p.get('notclosed') === '1',
    hasEvent: p.get('event') === '1',
    official: p.get('official') === '1' || p.get('verified') === '1' || p.get('claimed') === '1',
    featured: p.get('featured') === '1',
    mine: (mine === 'favorite' || mine === 'library' || mine === 'saved') ? mine as any : null,
    sort: (sort === 'reviews' || sort === 'saves' || sort === 'recent') ? sort as any : 'hot',
  }

  // section → 대응 필터
  if (section === 'event') base.hasEvent = true
  if (section === 'featured') base.featured = true
  if (section === 'favorite') base.mine = 'favorite'
  if (section === 'new') base.sort = 'recent'
  // 'hot'은 기본 정렬이라 손댈 것 없음

  // cat 슬러그 → 종류 이름 (필터는 이름으로 비교한다)
  if (catFromTile) {
    const meta = CAT_BY_SLUG[catFromTile]
    if (meta) base.cats = [meta]
  }

  return base
}
