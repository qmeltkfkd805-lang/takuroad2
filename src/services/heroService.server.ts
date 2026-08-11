// 홈 히어로 — 서버 계산 (수동 슬롯 우선 + 시작 예정 이벤트 자동 채움, 최대 5)
// 서버 전용: @/lib/supabase/server 를 쓰므로 클라이언트 컴포넌트에서 import 금지.
import { createClient } from '@/lib/supabase/server'
import { resolveEventCover } from '@/lib/event/eventCover'
import { HeroCard } from '@/lib/home/heroTypes'
import { startLabel, startMeta } from '@/lib/home/heroBadge'
import { AutoEventCand, rankAutoEvents, isFavoriteCand, mergeToMax } from '@/lib/home/heroSelect'

const MAX = 5
const AUTO_WINDOW_DAYS = 14

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

interface Keyed { key: string; card: HeroCard }

export async function getHeroSlots(): Promise<HeroCard[]> {
  // home_hero_slots 는 생성된 Database 타입에 아직 없어 any 로 다룬다 (빌드 타입체크 우회)
  const supabase: any = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null
  const today = ymd(new Date())
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
  const manual = await hydrateManual(supabase, slots)
  const manualEventIds = new Set<string>(
    slots.filter((s: any) => s.source_type === 'event').map((s: any) => s.source_id as string),
  )

  // 2) 남는 자리를 시작 예정 이벤트로 자동 채움
  const remaining = Math.max(0, MAX - manual.length)
  const auto = remaining > 0
    ? await buildAutoEvents(supabase, { userId, today, manualEventIds, want: remaining })
    : []

  // 3) 병합 (수동 우선, key 중복 제거, 최대 5)
  const merged = mergeToMax<Keyed>(manual, auto, (x) => x.key, MAX)
  return merged.map((m) => m.card)
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

/* ---------- 자동: 시작 예정 이벤트 ---------- */
async function buildAutoEvents(
  supabase: any,
  o: { userId: string | null; today: string; manualEventIds: Set<string>; want: number },
): Promise<Keyed[]> {
  const until = addDays(o.today, AUTO_WINDOW_DAYS)

  // 시작 예정(오늘 이후) + 14일 이내
  const { data: rows } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, start_date, cover_url, place_name, created_at')
    .gt('start_date', o.today)
    .lte('start_date', until)
    .order('start_date', { ascending: true })

  let evs = (rows ?? []).filter((e: any) => !o.manualEventIds.has(e.id) && e.title)
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
      const tag = e.tag_id ? tagMap.get(e.tag_id) : null
      const image = resolveEventCover({ eventCoverUrl: e.cover_url ?? null, workCoverUrl: tag?.cover_url ?? null })
      const place = (e.shop_id ? shopNameMap.get(e.shop_id)?.name : null) ?? e.place_name ?? null
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

  // 최애 태그
  const favTagIds = new Set<string>(o.userId ? await fetchFavoriteTagIds(supabase, o.userId) : [])
  const opts = { favTagIds, isLoggedIn: !!o.userId, today: o.today }

  const cands: AutoEventCand[] = complete.map((x: any) => ({
    eventId: x.e.id,
    tagId: x.e.tag_id ?? null,
    startDate: x.e.start_date,
    saveCount: saveCount.get(x.e.id) ?? 0,
    visitCount: visitCount.get(x.e.id) ?? 0,
    createdAt: x.e.created_at ?? '',
  }))

  const ranked = rankAutoEvents(cands, opts).slice(0, o.want)
  const byId = new Map(complete.map((x: any) => [x.e.id, x]))

  return ranked.map((c) => {
    const x: any = byId.get(c.eventId)
    const fav = isFavoriteCand(c, opts)
    return {
      key: `event:${c.eventId}`,
      card: {
        id: `auto:event:${c.eventId}`,
        category: 'event' as const,
        origin: fav ? ('auto-fav' as const) : ('auto-popular' as const),
        label: fav ? '최애 작품 새 소식' : '이번 주 오픈',
        headline: x.e.title,
        description: x.workName ?? null,
        imageUrl: x.image,
        ctaText: '이벤트 보기',
        ctaHref: `/event/${c.eventId}`,
        badge: startLabel(c.startDate, o.today),
        meta: startMeta(c.startDate, x.place),
      },
    }
  })
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
