// 홈 히어로 — 서버 계산 (수동 슬롯 우선 + 시작 예정 이벤트 자동 채움, 최대 5)
// 서버 전용: @/lib/supabase/server 를 쓰므로 클라이언트 컴포넌트에서 import 금지.
//
// ⚡ 속도: 누구에게나 같은 부분(수동 슬롯·시작 예정 이벤트 후보·저장/방문 수)은 60초 캐시(getHeroBase).
//    사용자마다 다른 건 "최애 작품 이벤트를 앞으로" 정렬 하나뿐이라, 그건 composeHero 에서 가볍게 계산한다.
//    홈 페이지는 비로그인 기준 히어로로 미리 만들어 두고(정적), 로그인 사용자는 /api/home/hero 로 개인화 결과를 받아 바꿔 낀다.
import { unstable_cache } from 'next/cache'
import { kstToday } from '@/lib/utils/kstDate'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAnonClient } from '@/lib/supabase/client'
import { resolveEventCover } from '@/lib/event/eventCover'
import { HeroCard } from '@/lib/home/heroTypes'
import { startLabel, startMeta } from '@/lib/home/heroBadge'
import { AutoEventCand, rankAutoEvents, isFavoriteCand, mergeToMax } from '@/lib/home/heroSelect'

const MAX = 5
const AUTO_WINDOW_DAYS = 14

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

interface Keyed { key: string; card: HeroCard; tagId?: string | null }

/** 자동 후보 하나 — 순위 계산 재료 + 카드에 쓸 표시 정보 (사용자와 무관) */
interface AutoBase {
  cand: AutoEventCand
  title: string
  workName: string | null
  image: string
  place: string | null
}

/** 사용자와 무관한 히어로 재료 */
export interface HeroBase {
  today: string
  manual: Keyed[]
  auto: AutoBase[]
}

async function loadHeroBase(supabase: any): Promise<HeroBase> {
  const today = kstToday()
  const nowIso = new Date().toISOString()

  // 1) 수동 슬롯 (게시중 + 노출기간 유효) — RLS 의존 않고 명시 필터 (관리자 홈에서 초안 노출 방지)
  const { data: rawSlots } = await supabase
    .from('home_hero_slots')
    .select('*')
    .eq('status', 'published')
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('is_pinned', { ascending: false })
    .order('slot_position', { ascending: true })
    .order('priority', { ascending: true })

  const slots = rawSlots ?? []
  const manualEventIds = new Set<string>(
    slots.filter((s: any) => s.source_type === 'event').map((s: any) => s.source_id as string),
  )
  // 수동 슬롯 채우기와 자동 후보 모으기는 서로 기다릴 필요가 없어 같이 한다
  const [manual, auto] = await Promise.all([
    hydrateManual(supabase, slots),
    loadAutoBase(supabase, { today, manualEventIds }),
  ])
  return { today, manual, auto }
}

/** 60초 캐시 — 비로그인(anon) 권한으로 읽는다. 비로그인 방문자가 보던 것과 같은 데이터. */
export const getHeroBase = unstable_cache(
  () => loadHeroBase(createAnonClient()),
  ['home-hero-base-v1'],
  { revalidate: 60 },
)

/** 재료 + (로그인 사용자의 최애 작품) → 최종 히어로 카드 (최대 5) */
export function composeHero(base: HeroBase, favTagIdList: string[], isLoggedIn: boolean): HeroCard[] {
  // 2) 남는 자리를 시작 예정 이벤트로 자동 채움
  const remaining = Math.max(0, MAX - base.manual.length)
  const opts = { favTagIds: new Set(favTagIdList), isLoggedIn, today: base.today }
  const byId = new Map(base.auto.map(a => [a.cand.eventId, a]))
  const auto: Keyed[] = remaining > 0
    ? rankAutoEvents(base.auto.map(a => a.cand), opts).slice(0, remaining).map((c) => {
        const x = byId.get(c.eventId)!
        const fav = isFavoriteCand(c, opts)
        return {
          key: `event:${c.eventId}`,
          tagId: c.tagId ?? null,
          card: {
            id: `auto:event:${c.eventId}`,
            category: 'event' as const,
            origin: fav ? ('auto-fav' as const) : ('auto-popular' as const),
            label: fav ? '최애 작품 새 소식' : '이번 주 오픈',
            headline: x.title,
            description: x.workName ?? null,
            imageUrl: x.image,
            ctaText: '이벤트 보기',
            ctaHref: `/event/${c.eventId}`,
            badge: startLabel(c.startDate, base.today),
            meta: startMeta(c.startDate, x.place),
          },
        }
      })
    : []

  // 3) 병합 (수동 우선, key 중복 제거)
  const merged = mergeToMax<Keyed>(base.manual, auto, (x) => x.key, MAX)

  // 4) 같은 작품(tag) 이벤트는 히어로에 하나만 — 지점만 다른 것/같은 콜라보 중복 방지.
  //    tag 없으면 제목(끝 지역 괄호 제거)으로 폴백. 먼저 온 것(수동 우선) 유지.
  const seenWork = new Set<string>()
  const seenTitle = new Set<string>()
  const deduped: Keyed[] = []
  for (const m of merged) {
    if (m.card.category === 'event') {
      const workKey = m.tagId ? `work:${m.tagId}` : null
      const t = (m.card.headline ?? '')
        .replace(/[\(（][^)）]*[\)）]\s*$/u, '')   // 끝의 (○○점) 제거
        .trim().replace(/\s+/g, ' ').toLowerCase()
      const titleKey = t ? `title:${t}` : null
      if (workKey && seenWork.has(workKey)) continue
      if (titleKey && seenTitle.has(titleKey)) continue
      if (workKey) seenWork.add(workKey)
      if (titleKey) seenTitle.add(titleKey)
    }
    deduped.push(m)
  }
  return deduped.map((m) => m.card)
}

/** 비로그인 기준 히어로 (홈 페이지를 미리 만들 때) */
export async function getPublicHeroSlots(): Promise<HeroCard[]> {
  return composeHero(await getHeroBase(), [], false)
}

/** 지금 로그인한 사용자 기준 히어로 (최애 작품 이벤트 우선) — /api/home/hero 에서 쓴다 */
export async function getHeroSlots(): Promise<HeroCard[]> {
  const supabase: any = await createClient()
  const [base, { data: { user } }] = await Promise.all([getHeroBase(), supabase.auth.getUser()])
  const userId = user?.id ?? null
  const favTagIds = userId ? await fetchFavoriteTagIds(supabase, userId) : []
  return composeHero(base, favTagIds, !!userId)
}

/* ---------- 수동 슬롯 하이드레이트 + 유효성 검사 ---------- */
async function hydrateManual(supabase: any, slots: any[]): Promise<Keyed[]> {
  if (slots.length === 0) return []
  const eventIds = slots.filter((s) => s.source_type === 'event').map((s) => s.source_id)
  const shopIds = slots.filter((s) => s.source_type === 'shop').map((s) => s.source_id)
  const noticeIds = slots.filter((s) => s.source_type === 'notice').map((s) => s.source_id)

  const [evMap, shopMap, noticeMap] = await Promise.all([
    fetchEvents(supabase, eventIds),
    fetchShops(supabase, shopIds),
    fetchNotices(supabase, noticeIds),
  ])

  const out: Keyed[] = []
  for (const s of slots) {
    if (s.source_type === 'event') {
      const ev = evMap.get(s.source_id)
      if (!ev) continue                                   // 삭제/비공개 → 자동 숨김
      const img = s.custom_image_url ?? ev.image
      const headline = s.custom_headline ?? ev.title
      if (!img || !headline) continue                     // 불완전 → 제외
      out.push({
        key: `event:${s.source_id}`,
        tagId: ev.tagId ?? null,
        card: {
          id: s.id, category: 'event', origin: 'manual',
          label: s.label ?? '관리자 추천 이벤트',
          headline,
          description: s.custom_description ?? ev.workName ?? null,
          imageUrl: img,
          ctaText: s.cta_text ?? '이벤트 보기',
          ctaHref: s.cta_href ?? `/event/${s.source_id}`,
          badge: startLabel(ev.startDate, undefined),
          meta: startMeta(ev.startDate, ev.place),
        },
      })
    } else if (s.source_type === 'shop') {
      const sh = shopMap.get(s.source_id)
      if (!sh || sh.status !== 'active') continue
      const img = s.custom_image_url ?? sh.image
      const headline = s.custom_headline ?? sh.name
      if (!img || !headline || !sh.addr || !sh.hasCats) continue
      out.push({
        key: `shop:${s.source_id}`,
        card: {
          id: s.id, category: 'shop', origin: 'manual',
          label: s.label ?? '검수 완료 신규 샵',
          headline,
          description: s.custom_description ?? sh.addr,
          imageUrl: img,
          ctaText: s.cta_text ?? '샵 보기',
          ctaHref: s.cta_href ?? `/shop/${sh.slug}`,
          badge: null,
          meta: '새로 등록된 샵',
        },
      })
    } else if (s.source_type === 'notice') {
      const nt = noticeMap.get(s.source_id)
      if (!nt) continue
      const headline = s.custom_headline ?? nt.title
      if (!headline) continue
      out.push({
        key: `notice:${s.source_id}`,
        card: {
          id: s.id, category: 'notice', origin: 'manual',
          label: s.label ?? '중요 공지',
          headline,
          description: s.custom_description ?? null,
          imageUrl: s.custom_image_url ?? nt.image ?? null,   // 없으면 배경색으로 (깨진 이미지 X)
          ctaText: s.cta_text ?? '공지 보기',
          ctaHref: s.cta_href ?? `/support/notice/${s.source_id}`,
          badge: null,
          meta: null,
        },
      })
    }
  }
  return out
}

/* ---------- 자동: 시작 예정 이벤트 후보 (사용자와 무관한 재료까지만) ---------- */
async function loadAutoBase(
  supabase: any,
  o: { today: string; manualEventIds: Set<string> },
): Promise<AutoBase[]> {
  const until = addDays(o.today, AUTO_WINDOW_DAYS)

  // 시작 예정(오늘 이후) + 14일 이내
  const { data: rows } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, start_date, cover_url, place_name, created_at')
    .gt('start_date', o.today)
    .lte('start_date', until)
    .order('start_date', { ascending: true })

  const evs = (rows ?? []).filter((e: any) => !o.manualEventIds.has(e.id) && e.title)
  if (evs.length === 0) return []

  // 작품 커버/이름, 샵 이름
  const tagIds = [...new Set(evs.map((e: any) => e.tag_id).filter(Boolean))]
  const shopIds = [...new Set(evs.map((e: any) => e.shop_id).filter(Boolean))]
  const [tagMap, shopNameMap] = await Promise.all([
    tagIds.length
      ? supabase.from('tags').select('id, name, cover_url').in('id', tagIds)
          .then((r: any) => new Map((r.data ?? []).map((t: any) => [t.id, t])))
      : new Map(),
    shopIds.length
      ? supabase.from('shops').select('id, name').in('id', shopIds)
          .then((r: any) => new Map((r.data ?? []).map((s: any) => [s.id, s])))
      : new Map(),
  ])

  // 이미지 완전성 필터
  const complete = evs
    .map((e: any) => {
      const tag: any = e.tag_id ? tagMap.get(e.tag_id) : null
      const image = resolveEventCover({ eventCoverUrl: e.cover_url ?? null, workCoverUrl: tag?.cover_url ?? null })
      const place = (e.shop_id ? (shopNameMap.get(e.shop_id) as any)?.name : null) ?? e.place_name ?? null
      return { e, image, workName: tag?.name ?? null, place }
    })
    .filter((x: any) => !!x.image)   // 이미지 없으면 히어로 제외

  if (complete.length === 0) return []

  // 저장/방문 수 집계
  const ids = complete.map((x: any) => x.e.id)
  const [saveCount, visitCount] = await Promise.all([
    countByEvent(supabase, 'saved_events', ids),
    countByEvent(supabase, 'event_visits', ids),
  ])

  return complete.map((x: any) => ({
    cand: {
      eventId: x.e.id,
      tagId: x.e.tag_id ?? null,
      startDate: x.e.start_date,
      saveCount: saveCount.get(x.e.id) ?? 0,
      visitCount: visitCount.get(x.e.id) ?? 0,
      createdAt: x.e.created_at ?? '',
    },
    title: x.e.title,
    workName: x.workName,
    image: x.image,
    place: x.place,
  }))
}

/* ---------- 작은 조회 헬퍼 ---------- */
async function fetchEvents(supabase: any, ids: string[]) {
  const map = new Map<string, any>()
  if (ids.length === 0) return map
  const { data } = await supabase
    .from('events')
    .select('id, tag_id, title, start_date, cover_url, place_name, shop_id')
    .in('id', ids)
  const tagIds = [...new Set((data ?? []).map((e: any) => e.tag_id).filter(Boolean))]
  const shopIds = [...new Set((data ?? []).map((e: any) => e.shop_id).filter(Boolean))]
  const [tagMap, shopMap] = await Promise.all([
    tagIds.length ? supabase.from('tags').select('id, name, cover_url').in('id', tagIds)
      .then((r: any) => new Map((r.data ?? []).map((t: any) => [t.id, t]))) : new Map(),
    shopIds.length ? supabase.from('shops').select('id, name').in('id', shopIds)
      .then((r: any) => new Map((r.data ?? []).map((s: any) => [s.id, s]))) : new Map(),
  ])
  for (const e of data ?? []) {
    const tag = e.tag_id ? tagMap.get(e.tag_id) : null
    map.set(e.id, {
      title: e.title,
      tagId: e.tag_id ?? null,
      startDate: e.start_date ?? null,
      image: resolveEventCover({ eventCoverUrl: e.cover_url ?? null, workCoverUrl: tag?.cover_url ?? null }),
      workName: tag?.name ?? null,
      place: (e.shop_id ? shopMap.get(e.shop_id)?.name : null) ?? e.place_name ?? null,
    })
  }
  return map
}

async function fetchShops(supabase: any, ids: string[]) {
  const map = new Map<string, any>()
  if (ids.length === 0) return map
  const { data } = await supabase
    .from('shops')
    .select('id, name, slug, status, addr, cats, shop_images ( image_url, is_cover, sort_order )')
    .in('id', ids)
  for (const s of data ?? []) {
    const imgs = s.shop_images ?? []
    const cover = imgs.find((i: any) => i.is_cover)?.image_url ?? imgs[0]?.image_url ?? null
    map.set(s.id, {
      name: s.name, slug: s.slug, status: s.status, addr: s.addr,
      hasCats: Array.isArray(s.cats) ? s.cats.length > 0 : !!s.cats,
      image: cover,
    })
  }
  return map
}

async function fetchNotices(supabase: any, ids: string[]) {
  const map = new Map<string, any>()
  if (ids.length === 0) return map
  const { data } = await supabase.from('notices').select('id, title, image_url').in('id', ids)
  for (const n of data ?? []) map.set(n.id, { title: n.title, image: n.image_url ?? null })
  return map
}

async function countByEvent(supabase: any, table: string, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (ids.length === 0) return map
  const { data } = await supabase.from(table).select('event_id').in('event_id', ids)
  for (const r of data ?? []) map.set(r.event_id, (map.get(r.event_id) ?? 0) + 1)
  return map
}

async function fetchFavoriteTagIds(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_favorite_tags')
    .select('tag_id')
    .eq('user_id', userId)
    .eq('tier', 'favorite')
  return (data ?? []).map((r: any) => r.tag_id)
}
