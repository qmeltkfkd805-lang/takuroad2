import { createClient } from '@/lib/supabase/client'

// 체크인 시 호출 — 그 샵의 취급 작품을 컬렉션에 자동 추가 (이미 있으면 visit_count만 증가)
export async function collectTagsFromCheckIn(userId: string, shopId: string): Promise<{ newlyCollected: string[] }> {
  const supabase = createClient()

  // 1. 이 샵의 취급 작품 목록 가져오기
  const { data: shopTags } = await supabase
    .from('shop_tags')
    .select('tag_id, tags ( name )')
    .eq('shop_id', shopId)

  if (!shopTags || shopTags.length === 0) return { newlyCollected: [] }

  // 2. 이미 가진 컬렉션 확인
  const tagIds = shopTags.map((st: any) => st.tag_id)
  const { data: existing } = await supabase
    .from('user_tag_collections')
    .select('tag_id')
    .eq('user_id', userId)
    .in('tag_id', tagIds)

  const existingTagIds = new Set((existing ?? []).map((e: any) => e.tag_id))
  const newTagIds = tagIds.filter(id => !existingTagIds.has(id))

  // 3. 새로 획득한 것은 INSERT
  if (newTagIds.length > 0) {
    await supabase.from('user_tag_collections').insert(
      newTagIds.map(tagId => ({
        user_id: userId,
        tag_id: tagId,
        first_shop_id: shopId,
      })) as any
    )
  }

  // 4. 이미 가진 것은 visit_count 증가 (이 샵 방문으로 카운트, RPC로 처리)
  for (const tagId of tagIds.filter(id => existingTagIds.has(id))) {
    await supabase.rpc('increment_tag_collection_visit', { p_user_id: userId, p_tag_id: tagId } as any)
  }

  const newlyCollectedNames = shopTags
    .filter((st: any) => newTagIds.includes(st.tag_id))
    .map((st: any) => st.tags?.name)
    .filter(Boolean)

  return { newlyCollected: newlyCollectedNames }
}

// 내 컬렉션 전체 조회 (작품 목록 + 획득 여부)
export async function getMyTagCollections(userId: string) {
  const supabase = createClient()

  const [{ data: allTags }, { data: myCollections }] = await Promise.all([
    supabase.from('tags').select('id, name, slug').order('name'),
    supabase.from('user_tag_collections').select('tag_id, visit_count, created_at').eq('user_id', userId),
  ])

  const collectedMap = new Map((myCollections ?? []).map((c: any) => [c.tag_id, c]))

  return (allTags ?? []).map((tag: any) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    isCollected: collectedMap.has(tag.id),
    visitCount: collectedMap.get(tag.id)?.visit_count ?? 0,
  }))
}

// 수동으로 작품 하나를 컬렉션에 추가 (사용자가 직접 선택)
export async function addTagToCollection(userId: string, tagId: string, shopId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_tag_collections')
    .upsert(
      { user_id: userId, tag_id: tagId, first_shop_id: shopId },
      { onConflict: 'user_id,tag_id' }
    )
  return !error
}

// 컬렉션에서 제거 (잘못 눌렀을 때 취소용)
export async function removeTagFromCollection(userId: string, tagId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_tag_collections')
    .delete()
    .eq('user_id', userId)
    .eq('tag_id', tagId)
  return !error
}

// 내가 이미 컬렉션에 가진 작품 id 목록
export async function getMyCollectedTagIds(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_tag_collections')
    .select('tag_id')
    .eq('user_id', userId)
  return (data ?? []).map((d: any) => d.tag_id)
}