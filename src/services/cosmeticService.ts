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

export interface WornSet {
  frame?: { slug: string; name: string }
  background?: { slug: string; name: string }
  title?: { slug: string; name: string }
  effect?: { slug: string; name: string }
  theme?: { slug: string; name: string }
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
    for (const v of Object.values((p.equipped ?? {}) as Record<string, string>)) {
      if (v) cosIds.add(v)
    }
  }

  if (cosIds.size === 0) {
    for (const p of rows) out.set(p.id, {})
    return out
  }

  const { data: cos } = await supabase
    .from('cosmetics').select('id, type, slug, name').in('id', [...cosIds])

  const byId = new Map(((cos ?? []) as any[]).map(c => [c.id, c]))

  for (const p of rows) {
    const worn: WornSet = {}
    for (const [type, id] of Object.entries((p.equipped ?? {}) as Record<string, string>)) {
      const c: any = byId.get(id)
      if (c) (worn as any)[type] = { slug: c.slug, name: c.name }
    }
    out.set(p.id, worn)
  }
  return out
}
