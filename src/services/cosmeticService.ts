import { createClient } from '@/lib/supabase/client'

/* ============================================================
   코스메틱 — 프로필 꾸미기

   ⭐⭐ 해금 테이블이 없다. user_badge_tiers(땄다) = 해금됐다.
      별도 user_cosmetics를 두면 이중 진실이 된다.
      (배지를 뺏으면 코스메틱도 자동으로 사라져야 하는데, 테이블이 둘이면 안 맞는다)

   ⭐ 착용은 profiles.equipped (jsonb) 하나에 담는다.
      { "frame": "uuid", "background": "uuid", "title": "uuid", "theme": "uuid" }
      새 type이 생겨도 스키마를 안 건드린다.

   ⭐ 이미지가 아직 없다. slug → CSS로 그린다 (lib/cosmetics/style.ts).
      asset_url이 채워지면 그게 우선한다. 가짜 이미지보다 진짜 CSS가 낫다.
   ============================================================ */

export type CosmeticType = 'frame' | 'background' | 'title' | 'effect' | 'theme' | string

/**
 * 관리자는 전부 해금 상태로 본다.
 * ⚠️ 보안이 아니라 편의다 — 코스메틱은 남에게 해가 없고,
 *    벚꽃 프레임이 어떻게 보이는지 배지를 따가며 확인할 순 없다.
 */
async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return (data as any)?.role === 'admin'
}

export interface Cosmetic {
  id: string
  type: CosmeticType
  slug: string
  name: string
  description: string | null
  rarity: string
  assetUrl: string | null
  isDefault: boolean
  /** 내가 해금했나 */
  unlocked: boolean
  /** 어떤 단계를 따야 열리나 (아직 못 딴 것) */
  fromBadge: string | null
}

/** 코스메틱 전체 + 내 해금 상태 */
export async function getMyCosmetics(userId: string): Promise<Cosmetic[]> {
  const supabase = createClient()

  const [cosRes, tierRes, earnedRes, admin] = await Promise.all([
    supabase.from('cosmetics').select('*').eq('is_hidden', false).order('type').order('sort_order'),
    supabase.from('badge_tiers').select('id, name, reward_cosmetic_id').not('reward_cosmetic_id', 'is', null),
    supabase.from('user_badge_tiers').select('badge_tier_id').eq('user_id', userId),
    isAdmin(userId),
  ])

  const earned = new Set((earnedRes.data ?? []).map((e: any) => e.badge_tier_id))
  const tiers = (tierRes.data ?? []) as any[]

  // 코스메틱 → 그걸 주는 단계들
  const byCos = new Map<string, any[]>()
  for (const t of tiers) {
    const list = byCos.get(t.reward_cosmetic_id) ?? []
    list.push(t)
    byCos.set(t.reward_cosmetic_id, list)
  }

  return ((cosRes.data ?? []) as any[]).map(c => {
    const sources = byCos.get(c.id) ?? []
    const unlocked = admin || c.is_default || sources.some(t => earned.has(t.id))
    return {
      id: c.id,
      type: c.type,
      slug: c.slug,
      name: c.name,
      description: c.description,
      rarity: c.rarity ?? 'common',
      assetUrl: c.asset_url ?? null,
      isDefault: c.is_default ?? false,
      unlocked,
      fromBadge: unlocked ? null : (sources[0]?.name ?? null),
    }
  })
}

export type Equipped = Record<string, string>

export async function getEquipped(userId: string): Promise<Equipped> {
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('equipped').eq('id', userId).maybeSingle()
  return ((data as any)?.equipped ?? {}) as Equipped
}

/**
 * 착용 / 해제 (cosmeticId가 null이면 벗는다).
 * ⚠️ 해금 안 한 걸 착용하려 하면 막는다 — 클라이언트를 믿지 않는다.
 */
export async function equipCosmetic(
  userId: string,
  type: string,
  cosmeticId: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()

  if (cosmeticId) {
    // getMyCosmetics가 이미 관리자를 전부 해금으로 본다 — 여기서 또 판별하지 않는다
    const all = await getMyCosmetics(userId)
    const target = all.find(c => c.id === cosmeticId)
    if (!target) return { ok: false, message: '없는 아이템이에요.' }
    if (!target.unlocked) return { ok: false, message: '아직 해금하지 않았어요.' }
  }

  const cur = await getEquipped(userId)
  const next: Equipped = { ...cur }
  if (cosmeticId) next[type] = cosmeticId
  else delete next[type]

  const { error } = await supabase.from('profiles').update({ equipped: next } as any).eq('id', userId)
  if (error) {
    console.error('[착용 실패]', error.message)
    return { ok: false, message: '착용에 실패했어요.' }
  }
  return { ok: true }
}

/** 성장 센터의 "이번 보상 미리보기" — 지금 도전 중인 단계가 주는 것 */
export async function getCosmeticById(id: string): Promise<Cosmetic | null> {
  const supabase = createClient()
  const { data } = await supabase.from('cosmetics').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const c: any = data
  return {
    id: c.id, type: c.type, slug: c.slug, name: c.name,
    description: c.description, rarity: c.rarity ?? 'common',
    assetUrl: c.asset_url ?? null, isDefault: c.is_default ?? false,
    unlocked: false, fromBadge: null,
  }
}

/* ────────────────────────────────────────────────
   여러 사람의 착용 코스메틱을 한 번에 (배치)

   ⭐ 커뮤니티 글 20개면 작성자도 20명이다.
      한 명씩 물어보면 쿼리가 20번 날아간다. 모아서 한 번만 묻는다.
   ──────────────────────────────────────────────── */

export interface WornItem {
  slug: string
  name: string
  /** 이미지가 있으면 CSS보다 이게 우선한다 */
  assetUrl?: string | null
}

export interface WornSet {
  frame?: WornItem
  background?: WornItem
  title?: WornItem
  effect?: WornItem
  theme?: WornItem
}

export async function getWornBatch(userIds: string[]): Promise<Map<string, WornSet>> {
  const out = new Map<string, WornSet>()
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return out

  const supabase = createClient()

  const { data: profs } = await supabase
    .from('profiles').select('id, equipped').in('id', ids)

  const rows = (profs ?? []) as any[]

  const cosIds = new Set<string>()
  for (const p of rows) {
    for (const v of Object.values((p.equipped ?? {}) as Record<string, unknown>)) {
      if (typeof v === 'string' && v) cosIds.add(v)
    }
  }

  if ([...cosIds].filter(Boolean).length === 0) {
    for (const p of rows) out.set(p.id, {})
    return out
  }

  const { data: cos } = await supabase
    .from('cosmetics').select('id, type, slug, name, asset_url').in('id', [...cosIds].filter(Boolean))

  const byId = new Map(((cos ?? []) as any[]).map(c => [c.id, c]))

  for (const p of rows) {
    const worn: WornSet = {}
    for (const [type, id] of Object.entries((p.equipped ?? {}) as Record<string, string>)) {
      const c: any = byId.get(id)
      if (c) (worn as any)[type] = { slug: c.slug, name: c.name, assetUrl: c.asset_url ?? null }
    }
    out.set(p.id, worn)
  }
  return out
}

/* ────────────────────────────────────────────────
   대표 배지 (showcase) — 최대 3개 진열

   ⭐ 칭호(cosmetic title)와 대표 배지는 다른 것이다.
      칭호   = 내가 고른 이름       "덕질 장인"
      대표배지 = 내가 자랑할 성취     "리뷰 마스터 Lv3"

   ⭐ 그래도 설정 화면은 하나다. /cosmetic에서 다 바꾼다.
      역할은 나누되 입구는 하나 — 사용자가 두 군데를 찾아다니면 안 된다.

   ⭐ 새 테이블·새 컬럼 없음. equipped jsonb의 showcase 배열에 담는다.
      (옛 profiles.selected_title_id는 여기로 이사했다. 컬럼은 코드 정리 후 삭제)
   ──────────────────────────────────────────────── */

export const SHOWCASE_MAX = 3

export interface ShowcaseBadge {
  tierId: string
  name: string
  rarity: string
  icon: string | null
  badgeName: string
  earned?: boolean
  earnedAt: string
}

/** 내가 딴 배지 전부 (대표 배지로 고를 수 있는 후보) */
export async function getMyBadges(userId: string): Promise<ShowcaseBadge[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_badge_tiers')
    .select('badge_tier_id, earned_at, badge_tiers ( name, rarity, icon_url, is_active, badges ( name, icon_url ) )')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  return ((data ?? []) as any[]).filter(r => r.badge_tiers?.is_active !== false).map(r => ({
    tierId: r.badge_tier_id,
    name: r.badge_tiers?.name ?? '배지',
    rarity: r.badge_tiers?.rarity ?? 'common',
    icon: r.badge_tiers?.icon_url ?? r.badge_tiers?.badges?.icon_url ?? null,
    badgeName: r.badge_tiers?.badges?.name ?? '',
    earnedAt: r.earned_at,
  }))
}

/** 지금 진열 중인 대표 배지 id들 */
export async function getShowcase(userId: string): Promise<string[]> {
  const eq = await getEquipped(userId)
  const raw = (eq as any).showcase
  return Array.isArray(raw) ? raw.filter(Boolean).slice(0, SHOWCASE_MAX) : []
}

/** 대표 배지 토글 — 이미 있으면 빼고, 없으면 넣는다 (최대 3개) */
export async function toggleShowcase(
  userId: string,
  tierId: string,
): Promise<{ ok: boolean; showcase: string[]; message?: string }> {
  const supabase = createClient()
  const cur = await getShowcase(userId)

  let next: string[]
  if (cur.includes(tierId)) {
    next = cur.filter(id => id !== tierId)
  } else {
    if (cur.length >= SHOWCASE_MAX) {
      return { ok: false, showcase: cur, message: '대표 배지는 최대 ' + SHOWCASE_MAX + '개까지예요.' }
    }
    next = [...cur, tierId]
  }

  const eq = await getEquipped(userId)
  const merged: any = { ...eq, showcase: next }

  const { error } = await supabase.from('profiles').update({ equipped: merged } as any).eq('id', userId)
  if (error) {
    console.error('[대표 배지 저장 실패]', error.message)
    return { ok: false, showcase: cur, message: '저장에 실패했어요.' }
  }
  return { ok: true, showcase: next }
}

/** 남의 프로필에서도 쓴다 — 대표 배지 상세 */
export async function getAllBadges(userId: string): Promise<ShowcaseBadge[]> {
  const supabase = createClient()
  const [tiersRes, earnedRes] = await Promise.all([
    supabase.from('badge_tiers').select('id, name, rarity, icon_url, sort_order, badges ( name, icon_url, sort_order )').eq('is_active', true),
    supabase.from('user_badge_tiers').select('badge_tier_id, earned_at').eq('user_id', userId),
  ])
  const earnedMap = new Map(((earnedRes.data ?? []) as any[]).map(e => [e.badge_tier_id, e.earned_at]))
  return ((tiersRes.data ?? []) as any[])
    .map(t => ({
      tierId: t.id,
      name: t.name ?? '배지',
      rarity: t.rarity ?? 'common',
      icon: t.icon_url ?? t.badges?.icon_url ?? null,
      badgeName: t.badges?.name ?? '',
      earned: earnedMap.has(t.id),
      earnedAt: (earnedMap.get(t.id) as string) ?? '',
    }))
    .sort((a, b) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0))
}

export async function getShowcaseBadges(userId: string): Promise<ShowcaseBadge[]> {
  const ids = await getShowcase(userId)
  if (ids.length === 0) return []
  const all = await getMyBadges(userId)
  // 진열 순서 유지
  return ids.map(id => all.find(b => b.tierId === id)).filter(Boolean) as ShowcaseBadge[]
}


/* ============================================================
   여권 대표 작품 — equipped.featuredWork (tag_id 하나)
   최애 작품(user_favorite_tags tier=favorite) 중에서 고른다.
   ============================================================ */

/** 여권에 띄울 대표 작품 tag_id */
export async function getFeaturedWork(userId: string): Promise<string | null> {
  const eq = await getEquipped(userId)
  const raw = (eq as any).featuredWork
  return typeof raw === 'string' && raw ? raw : null
}

/** 대표 작품 설정 (null이면 해제) */
export async function setFeaturedWork(userId: string, tagId: string | null): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const eq = await getEquipped(userId)
  const merged: any = { ...eq, featuredWork: tagId ?? null }
  const { error } = await supabase.from('profiles').update({ equipped: merged } as any).eq('id', userId)
  if (error) {
    console.error('[대표 작품 저장 실패]', error.message)
    return { ok: false }
  }
  return { ok: true }
}

/** 최애 작품 목록 (선택지용) */
export async function getMyFavoriteWorks(
  userId: string,
): Promise<{ tagId: string; name: string; slug: string | null; cover: string | null }[]> {
  const supabase = createClient()
  const { data: favs } = await supabase
    .from('user_favorite_tags')
    .select('tag_id')
    .eq('user_id', userId)
    .eq('tier', 'favorite')

  const ids = (favs ?? []).map((r: any) => r.tag_id).filter(Boolean)
  if (ids.length === 0) return []

  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, slug, cover_url')
    .in('id', ids)

  return ((tags ?? []) as any[]).map(t => ({
    tagId: t.id,
    name: t.name ?? '작품',
    slug: t.slug ?? null,
    cover: t.cover_url ?? null,
  }))
}
