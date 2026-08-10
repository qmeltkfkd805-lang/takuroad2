import { createClient } from '@/lib/supabase/client'
import { getMyWorkRelationships } from '@/services/workRelationshipService'

/* ============================================================
   최애 새소식(/my-news) 데이터 계층
   - 홈 최애 새소식과 같은 소스(events)를 쓰되, "작품당 1건"이 아니라
     최애·관심 작품의 소식을 전부 모아 NewsItem[]으로 반환한다.
   - 읽음 상태는 user_news_reads 테이블(경량 키)로 사용자별 관리.
     테이블이 아직 없으면 조용히 degrade(전부 안읽음, 쓰기 no-op) → UI는 동작.
   ============================================================ */

export type NewsCat = 'event' | 'shop' | 'goods' | 'official'

// 카테고리별 라벨/색 — 탭과 소식 행 배지가 같은 색을 쓴다(선택 탭만 브랜드 핑크로 강조).
export const NEWS_CATS: { key: NewsCat; label: string; color: string; colorL: string }[] = [
  { key: 'event',    label: '이벤트',   color: '#14B8A0', colorL: 'rgba(20,184,160,.12)' },
  { key: 'shop',     label: '샵·팝업',  color: '#F5820A', colorL: 'rgba(245,130,10,.12)' },
  { key: 'goods',    label: '굿즈',     color: '#8B6BD9', colorL: 'rgba(139,107,217,.14)' },
  { key: 'official', label: '공식 소식', color: '#3B9BE8', colorL: 'rgba(59,155,232,.12)' },
]
export const NEWS_CAT_MAP: Record<NewsCat, { label: string; color: string; colorL: string }> =
  Object.fromEntries(NEWS_CATS.map(c => [c.key, { label: c.label, color: c.color, colorL: c.colorL }])) as any

// events.type → 카테고리
const TYPE_CAT: Record<string, NewsCat> = {
  popup: 'shop',
  collab_cafe: 'event',
  exhibition: 'event',
  goods_added: 'goods',
  official_event: 'official',
}

export interface NewsItem {
  key: string            // 'event:{id}' — 읽음/중복 판단용 안정 키
  eventId: string        // saved_events 저장용
  cat: NewsCat
  workId: string
  workName: string
  title: string
  meta: string | null    // 기간 · 장소
  createdAt: string
  endDate: string | null
  thumbUrl: string | null
  href: string
  isOfficial: boolean
}

const md = (d?: string | null): string | null => {
  if (!d) return null
  const m = d.slice(5, 7).replace(/^0/, ''); const day = d.slice(8, 10).replace(/^0/, '')
  return m && day ? `${m}.${day}` : null
}
const period = (s?: string | null, e?: string | null): string | null =>
  md(s) && md(e) ? `${md(s)} - ${md(e)}` : md(s) ?? null

/** 로그인 사용자의 최애·관심 작품 소식 전체 (최신순). 소식 없으면 []. */
export async function getMyNews(userId: string, limit = 200): Promise<NewsItem[]> {
  const rels = await getMyWorkRelationships(userId)
  const works = rels.filter(r => r.affinity)   // 최애/관심만
  if (works.length === 0) return []

  const workMap = new Map(works.map(w => [w.work.id, w.work]))
  const tagIds = [...workMap.keys()]

  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, created_at, start_date, end_date, cover_url, place_name')
    .in('tag_id', tagIds)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []

  // 샵 이름/슬러그/대표이미지 배치 조회
  const shopIds = [...new Set(data.map((e: any) => e.shop_id).filter(Boolean))]
  let shopMap = new Map<string, any>()
  if (shopIds.length) {
    const { data: shops } = await supabase
      .from('shops')
      .select('id, name, slug, shop_images ( image_url, is_cover )')
      .in('id', shopIds)
    shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]))
  }

  const seen = new Set<string>()
  const items: NewsItem[] = []
  for (const e of data as any[]) {
    const key = `event:${e.id}`
    if (seen.has(key)) continue        // 같은 게시물 중복 제거
    seen.add(key)

    const work = workMap.get(e.tag_id)
    if (!work) continue
    const cat: NewsCat = TYPE_CAT[e.type] ?? 'event'
    const isOfficial = cat === 'official'

    const shop = e.shop_id ? shopMap.get(e.shop_id) : null
    const shopName = shop?.name ?? null
    const shopSlug = shop?.slug ?? null
    const shopCover = shop
      ? ((shop.shop_images ?? []).find((i: any) => i.is_cover)?.image_url
         ?? (shop.shop_images ?? [])[0]?.image_url ?? null)
      : null

    // 썸네일 규칙: 공식 소식은 og/외부 자동사용 금지 → 작품 커버 기본값.
    // 그 외: 이벤트 대표 → 샵 이미지 → 작품 커버.
    const thumbUrl = isOfficial
      ? (work.coverUrl ?? null)
      : (e.cover_url ?? shopCover ?? work.coverUrl ?? null)

    // 상세 이동: 샵·굿즈는 샵 상세(없으면 이벤트), 이벤트·공식은 내부 이벤트 상세
    const href = (cat === 'shop' || cat === 'goods')
      ? (shopSlug ? `/shop/${shopSlug}` : `/event/${e.id}`)
      : `/event/${e.id}`

    const metaParts = [shopName ?? e.place_name, period(e.start_date, e.end_date)].filter(Boolean)

    items.push({
      key,
      eventId: e.id,
      cat,
      workId: work.id,
      workName: work.name,
      title: e.title || NEWS_CAT_MAP[cat].label,
      meta: metaParts.length ? metaParts.join(' · ') : null,
      createdAt: e.created_at,
      endDate: e.end_date ?? null,
      thumbUrl,
      href,
      isOfficial,
    })
  }
  return items
}

/* ---------------- 읽음 상태 (user_news_reads) ---------------- */
// 테이블이 없거나 오류면 조용히 degrade — 피드는 계속 동작한다.

export async function getMyReadNewsKeys(userId: string): Promise<Set<string>> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from('user_news_reads').select('news_key').eq('user_id', userId)
    if (error) return new Set()
    return new Set((data ?? []).map((r: any) => r.news_key))
  } catch { return new Set() }
}

export async function markNewsRead(userId: string, key: string): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from('user_news_reads')
      .upsert({ user_id: userId, news_key: key } as any, { onConflict: 'user_id,news_key', ignoreDuplicates: true })
  } catch { /* noop */ }
}

export async function markNewsReadBulk(userId: string, keys: string[]): Promise<void> {
  if (!keys.length) return
  try {
    const supabase = createClient()
    const rows = keys.map(k => ({ user_id: userId, news_key: k }))
    await supabase.from('user_news_reads')
      .upsert(rows as any, { onConflict: 'user_id,news_key', ignoreDuplicates: true })
  } catch { /* noop */ }
}
