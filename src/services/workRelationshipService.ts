import { createClient } from '@/lib/supabase/client'
import {
  WorkRelationship, FavoriteTier, RelationshipState,
} from '@/types/work-relationship'

// 이 작품의 현재 관계 강도(최애/좋아하는 작품/없음) 하나만 조회
export async function getAffinity(userId: string, tagId: string): Promise<FavoriteTier | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_favorite_tags')
    .select('tier')
    .eq('user_id', userId)
    .eq('tag_id', tagId)
    .maybeSingle()
  return (data as any)?.tier ?? null
}

// 여러 작품의 affinity를 한 번에 조회 — { tagId: tier } 맵 반환.
// 리스트(샵 상세 취급 작품 등)에서 작품마다 따로 조회하는 N+1을 피함.
export async function getAffinitiesForTags(
  userId: string, tagIds: string[]
): Promise<Record<string, FavoriteTier>> {
  if (tagIds.length === 0) return {}
  const supabase = createClient()
  const { data } = await supabase
    .from('user_favorite_tags')
    .select('tag_id, tier')
    .eq('user_id', userId)
    .in('tag_id', tagIds)

  const map: Record<string, FavoriteTier> = {}
  for (const row of data ?? []) {
    map[(row as any).tag_id] = (row as any).tier
  }
  return map
}

// 이 작품의 현재 관계 상태(볼예정/보는중/완료/보류/없음) 하나만 조회
export async function getRelationshipState(userId: string, tagId: string): Promise<RelationshipState | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_library')
    .select('status')
    .eq('user_id', userId)
    .eq('tag_id', tagId)
    .maybeSingle()
  return (data as any)?.status ?? null
}

// "내 작품" — 세 축(favorite/library/collections)을 tag_id로 합쳐
// WorkRelationship[] 로 반환. 어느 한 축이라도 있는 작품의 합집합.
export async function getMyWorkRelationships(userId: string): Promise<WorkRelationship[]> {
  const supabase = createClient()

  const [{ data: favs }, { data: lib }, { data: cols }] = await Promise.all([
    supabase.from('user_favorite_tags').select('tag_id, tier').eq('user_id', userId),
    supabase.from('user_library').select('tag_id, status').eq('user_id', userId),
    supabase.from('user_tag_collections').select('tag_id, visit_count, created_at').eq('user_id', userId),
  ])

  const map = new Map<string, {
    affinity: FavoriteTier | null
    state: RelationshipState | null
    activity: { visitCount: number; collectedAt: string } | null
  }>()
  const ensure = (tagId: string) => {
    if (!map.has(tagId)) map.set(tagId, { affinity: null, state: null, activity: null })
    return map.get(tagId)!
  }

  for (const f of favs ?? []) ensure((f as any).tag_id).affinity = (f as any).tier
  for (const l of lib ?? [])  ensure((l as any).tag_id).state    = (l as any).status
  for (const c of cols ?? []) ensure((c as any).tag_id).activity = {
    visitCount: (c as any).visit_count ?? 0,
    collectedAt: (c as any).created_at,
  }

  if (map.size === 0) return []

  const tagIds = [...map.keys()]
  const { data: tags } = await supabase
    .from('tags').select('id, name, slug').in('id', tagIds)

  const tagMap = new Map((tags ?? []).map((t: any) => [t.id, t]))

  const result: WorkRelationship[] = []
  for (const [tagId, axes] of map) {
    const tag = tagMap.get(tagId)
    if (!tag) continue
    result.push({
      work: { id: tag.id, name: tag.name, slug: tag.slug },
      affinity: axes.affinity,
      state: axes.state,
      activity: axes.activity,
    })
  }
  return result
}

// 관계 강도(Affinity) 설정/해제 — user_favorite_tags
export async function setAffinity(userId: string, tagId: string, tier: FavoriteTier): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_favorite_tags')
    .upsert({ user_id: userId, tag_id: tagId, tier }, { onConflict: 'user_id,tag_id' })
  return !error
}

export async function clearAffinity(userId: string, tagId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_favorite_tags').delete()
    .eq('user_id', userId).eq('tag_id', tagId)
  return !error
}

// 관계 상태(State) 설정/해제 — user_library
export async function setRelationshipState(userId: string, tagId: string, status: RelationshipState): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_library')
    .upsert({ user_id: userId, tag_id: tagId, status }, { onConflict: 'user_id,tag_id' })
  return !error
}

export async function clearRelationshipState(userId: string, tagId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_library').delete()
    .eq('user_id', userId).eq('tag_id', tagId)
  return !error
}