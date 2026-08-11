import { createClient } from '@/lib/supabase/client'
import { adminUpsert } from '@/services/adminUpsertService'
import { HeroCategory, HeroCard } from '@/lib/home/heroTypes'

// 관리자 미리보기 — 실제 홈에 나갈 최종 구성(수동+자동)
export async function getHeroPreview(): Promise<HeroCard[]> {
  try {
    const res = await fetch('/api/admin/hero-preview')
    if (!res.ok) return []
    const j = await res.json()
    return (j.cards ?? []) as HeroCard[]
  } catch { return [] }
}

const today = () => new Date().toISOString().slice(0, 10)

export interface HeroSlotRow {
  id: string
  source_type: HeroCategory
  source_id: string
  label: string | null
  custom_headline: string | null
  custom_description: string | null
  custom_image_url: string | null
  cta_text: string | null
  cta_href: string | null
  starts_at: string | null
  ends_at: string | null
  slot_position: number
  priority: number
  is_pinned: boolean
  status: 'draft' | 'scheduled' | 'published' | 'ended'
  created_at: string
  updated_at: string
}

// 목록 표시용 — 슬롯 + 원본 제목/썸네일/유효성
export interface HeroSlotView extends HeroSlotRow {
  sourceTitle: string | null
  sourceThumb: string | null
  sourceOk: boolean       // 원본이 살아있고 노출 가능한가
  startDate: string | null
}

/* ---------- 목록 ---------- */
export async function listHeroSlots(): Promise<HeroSlotView[]> {
  const supabase: any = createClient()   // home_hero_slots 등: Database 타입 미포함 → any
  const { data, error } = await supabase
    .from('home_hero_slots')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('slot_position', { ascending: true })
    .order('priority', { ascending: true })
  if (error) { console.error('[히어로] 목록 실패:', error.message); return [] }
  const rows = (data ?? []) as HeroSlotRow[]
  if (rows.length === 0) return []

  const evIds = rows.filter(r => r.source_type === 'event').map(r => r.source_id)
  const shopIds = rows.filter(r => r.source_type === 'shop').map(r => r.source_id)
  const noticeIds = rows.filter(r => r.source_type === 'notice').map(r => r.source_id)

  const [evMap, shopMap, noticeMap] = await Promise.all([
    evIds.length ? supabase.from('events').select('id, title, start_date, cover_url, tag_id, tags(cover_url)').in('id', evIds)
      .then((r: any) => new Map((r.data ?? []).map((e: any) => [e.id, e]))) : new Map(),
    shopIds.length ? supabase.from('shops').select('id, name, status, addr, cats, shop_images(image_url, is_cover)').in('id', shopIds)
      .then((r: any) => new Map((r.data ?? []).map((s: any) => [s.id, s]))) : new Map(),
    noticeIds.length ? supabase.from('notices').select('id, title, image_url, is_pinned').in('id', noticeIds)
      .then((r: any) => new Map((r.data ?? []).map((n: any) => [n.id, n]))) : new Map(),
  ])

  return rows.map(r => {
    let sourceTitle: string | null = null
    let sourceThumb: string | null = null
    let sourceOk = false
    let startDate: string | null = null
    if (r.source_type === 'event') {
      const e = evMap.get(r.source_id)
      if (e) { sourceTitle = e.title; startDate = e.start_date ?? null; sourceThumb = r.custom_image_url ?? e.cover_url ?? e.tags?.cover_url ?? null; sourceOk = !!(e.title && sourceThumb) }
    } else if (r.source_type === 'shop') {
      const s = shopMap.get(r.source_id)
      const cover = s ? (s.shop_images?.find((i: any) => i.is_cover)?.image_url ?? s.shop_images?.[0]?.image_url ?? null) : null
      if (s) { sourceTitle = s.name; sourceThumb = r.custom_image_url ?? cover; sourceOk = s.status === 'active' && !!sourceThumb && !!s.addr }
    } else {
      const n = noticeMap.get(r.source_id)
      if (n) { sourceTitle = n.title; sourceThumb = r.custom_image_url ?? n.image_url ?? null; sourceOk = !!n.title }
    }
    return { ...r, sourceTitle, sourceThumb, sourceOk, startDate }
  })
}

// 관리자 요약 카운트
export function heroSummary(views: HeroSlotView[]) {
  const now = Date.now()
  const inWindow = (v: HeroSlotView) =>
    (!v.starts_at || Date.parse(v.starts_at) <= now) && (!v.ends_at || Date.parse(v.ends_at) >= now)
  const shownManual = views.filter(v => v.status === 'published' && v.sourceOk && inWindow(v))
  const pinned = shownManual.filter(v => v.is_pinned)
  const scheduled = views.filter(v => v.status === 'scheduled' || (v.status === 'published' && v.starts_at && Date.parse(v.starts_at) > now))
  const autoFill = Math.max(0, 5 - shownManual.length)
  return { shown: shownManual.length, pinned: pinned.length, autoFill, scheduled: scheduled.length }
}

/* ---------- 검색 (연결할 원본 찾기) ---------- */
export interface HeroCandidate { id: string; title: string; thumb: string | null; sub: string | null }

export async function searchHeroEvents(q: string): Promise<HeroCandidate[]> {
  const supabase: any = createClient()   // home_hero_slots 등: Database 타입 미포함 → any
  let query = supabase
    .from('events')
    .select('id, title, start_date, cover_url, place_name, tag_id, tags(name, cover_url)')
    .gt('start_date', today())
    .order('start_date', { ascending: true })
    .limit(12)
  if (q.trim()) query = query.ilike('title', `%${q.trim()}%`)
  const { data } = await query
  return (data ?? [])
    .map((e: any) => ({
      id: e.id,
      title: e.title,
      thumb: e.cover_url ?? e.tags?.cover_url ?? null,
      sub: [e.start_date ? `${e.start_date} 시작` : null, e.tags?.name ?? e.place_name ?? null].filter(Boolean).join(' · ') || null,
    }))
    .filter((c: HeroCandidate) => !!c.title && !!c.thumb)   // 이미지·제목 완전한 것만
}

export async function searchHeroShops(q: string): Promise<HeroCandidate[]> {
  const supabase: any = createClient()   // home_hero_slots 등: Database 타입 미포함 → any
  let query = supabase
    .from('shops')
    .select('id, name, slug, addr, cats, status, shop_images(image_url, is_cover)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(12)
  if (q.trim()) query = query.ilike('name', `%${q.trim()}%`)
  const { data } = await query
  return (data ?? [])
    .map((s: any) => {
      const thumb = s.shop_images?.find((i: any) => i.is_cover)?.image_url ?? s.shop_images?.[0]?.image_url ?? null
      const hasCats = Array.isArray(s.cats) ? s.cats.length > 0 : !!s.cats
      return { id: s.id, title: s.name, thumb, sub: s.addr ?? null, _ok: !!thumb && !!s.addr && hasCats }
    })
    .filter((c: any) => c._ok)
    .map(({ _ok, ...c }: any) => c)
}

export async function searchHeroNotices(q: string): Promise<HeroCandidate[]> {
  const supabase: any = createClient()   // home_hero_slots 등: Database 타입 미포함 → any
  // 관리자가 직접 고르는 자리라 모든 공지를 검색하고, 중요(고정) 여부는 배지로만 표시.
  // 고정 공지를 위로 오게 정렬.
  let query = supabase
    .from('notices')
    .select('id, title, image_url, is_pinned, created_at')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)
  if (q.trim()) query = query.ilike('title', `%${q.trim()}%`)
  const { data, error } = await query
  if (error) { console.error('[히어로] 공지 검색 실패:', error.message); return [] }
  return (data ?? []).map((n: any) => ({ id: n.id, title: n.title, thumb: n.image_url ?? null, sub: n.is_pinned ? '중요 공지' : '공지' }))
}

/* ---------- 저장 / 상태 변경 ---------- */
export interface HeroSlotDraft {
  source_type: HeroCategory
  source_id: string
  label: string | null
  custom_headline: string | null
  custom_description: string | null
  custom_image_url: string | null
  cta_text: string | null
  cta_href: string | null
  starts_at: string | null
  ends_at: string | null
  slot_position: number
  priority: number
  is_pinned: boolean
  status: 'draft' | 'scheduled' | 'published' | 'ended'
}

export async function saveHeroSlot(draft: HeroSlotDraft, id?: string) {
  return adminUpsert({ table: 'home_hero_slots', id, fields: draft, action: id ? 'update' : 'insert' })
}
export async function endHeroSlot(id: string) {
  return adminUpsert({ table: 'home_hero_slots', id, fields: { status: 'ended' }, action: 'update' })
}
export async function deleteHeroSlot(id: string) {
  return adminUpsert({ table: 'home_hero_slots', id, action: 'delete' })
}
