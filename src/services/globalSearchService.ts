import { createClient } from '@/lib/supabase/client'

export interface GlobalSearchResult {
  shops: { id: string; name: string; slug: string }[]
  products: {
    shopId: string
    shopName: string
    shopSlug: string
    tagName: string
    characterName: string | null
    goodsTypeName: string
    availability: string
    lastConfirmedAt: string | null
    confirmCount: number
  }[]
  tags: { id: string; name: string; slug: string }[]
  characters: { id: string; name: string; tagName: string }[]
  totalCount: number
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ')
}

// 검색어를 단어로 분리 (AND 검색용)
function parseSearchTerms(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean)
}

// 공백 제거 + 소문자 (띄어쓰기 무시 비교용)
function stripSpaces(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '')
}

type TagSearchRow = { id: string; name: string; slug: string }

async function searchTags(query: string): Promise<TagSearchRow[]> {
  const supabase = createClient()
  const terms = parseSearchTerms(query)
  const select = 'id, name, slug'

  let byName = supabase.from('tags').select(select)
  let byEnglishName = supabase.from('tags').select(select)
  for (const term of terms) {
    byName = byName.ilike('name', `%${term}%`)
    byEnglishName = byEnglishName.ilike('english_name', `%${term}%`)
  }

  const results = await Promise.all([
    byName.limit(5),
    byEnglishName.limit(5),
    supabase.from('tags').select(select).contains('aliases', [query.trim()]).limit(5),
  ])
  const unique = new Map<string, TagSearchRow>()
  for (const result of results) {
    if (result.error) continue
    for (const row of result.data ?? []) unique.set(row.id, row as TagSearchRow)
  }
  return [...unique.values()].slice(0, 5)
}

export async function globalSearch(query: string, userId?: string | null, anonymousId?: string): Promise<GlobalSearchResult> {
  const supabase = createClient()
  const terms = parseSearchTerms(query)

  if (terms.length === 0) {
    return { shops: [], products: [], tags: [], characters: [], totalCount: 0 }
  }

  // 1. 샵 이름 검색 (첫 단어 기준, 가장 일반적인 검색)
  const { data: shopsData } = await supabase
    .from('shops')
    .select('id, name, slug')
    .eq('status', 'active')
    .ilike('name', `%${query.trim()}%`)
    .limit(10)

  // 2. 작품(tags) 매칭 — 띄어쓰기 무시 (공백 떼고 첫 단어 포함). "가정교사히트맨리본"도 "가정교사 히트맨 리본" 매칭
  const term0 = stripSpaces(terms[0])
  const tagsData = await searchTags(query)

  // 3. 캐릭터 매칭
  const { data: charactersData } = await supabase
    .from('characters')
    .select('id, name, tag_id, tags ( name )')
    .ilike('name', `%${terms[0]}%`)
    .limit(5)

  // 4. 굿즈타입 매칭 — 띄어쓰기 무시 (예: "아크릴스탠드" → "아크릴 스탠드")
  const { data: allGoodsTypesData } = await supabase
    .from('goods_types')
    .select('id, name')
  const goodsTypesData = (allGoodsTypesData ?? [])
    .filter((g: any) => stripSpaces(g.name).includes(term0))
    .slice(0, 5)

  // 5. shop_products에서 매칭되는 굿즈 찾기
  let products: any[] = []

  const matchedTagIds = (tagsData ?? []).map(t => t.id)
  const matchedCharacterIds = (charactersData ?? []).map((c: any) => c.id)
  const matchedGoodsTypeIds = (goodsTypesData ?? []).map(g => g.id)

  if (matchedTagIds.length > 0 || matchedCharacterIds.length > 0 || matchedGoodsTypeIds.length > 0) {
    let productQuery = supabase
      .from('shop_products')
      .select(`
        id, availability, last_confirmed_at, confirm_count,
        shops ( id, name, slug ),
        tags ( name ),
        characters ( name ),
        goods_types ( name )
      `)
      .eq('is_active', true)
      .limit(30)

    // 추가 검색어(2번째 단어부터)가 있으면 AND 조건으로 굿즈타입/캐릭터 추가 매칭
    const orConditions: string[] = []
    if (matchedTagIds.length > 0) orConditions.push(`tag_id.in.(${matchedTagIds.join(',')})`)
    if (matchedCharacterIds.length > 0) orConditions.push(`character_id.in.(${matchedCharacterIds.join(',')})`)
    if (matchedGoodsTypeIds.length > 0) orConditions.push(`goods_type_id.in.(${matchedGoodsTypeIds.join(',')})`)

    if (orConditions.length > 0) {
      productQuery = productQuery.or(orConditions.join(','))
    }

    const { data } = await productQuery
    products = data ?? []

    // 복합 검색(2개 이상 단어)이면, 두 번째 단어도 매칭되는 것만 필터링
    if (terms.length > 1) {
      const secondTerm = stripSpaces(terms[1])
      products = products.filter((p: any) =>
        stripSpaces(p.tags?.name ?? '').includes(secondTerm) ||
        stripSpaces(p.characters?.name ?? '').includes(secondTerm) ||
        stripSpaces(p.goods_types?.name ?? '').includes(secondTerm)
      )
    }
  }

  const formattedProducts = products.map((p: any) => ({
    shopId: p.shops?.id,
    shopName: p.shops?.name,
    shopSlug: p.shops?.slug,
    tagName: p.tags?.name,
    characterName: p.characters?.name ?? null,
    goodsTypeName: p.goods_types?.name,
    availability: p.availability,
    lastConfirmedAt: p.last_confirmed_at,
    confirmCount: p.confirm_count,
  }))

  const result: GlobalSearchResult = {
    shops: shopsData ?? [],
    products: formattedProducts,
    tags: tagsData ?? [],
    characters: (charactersData ?? []).map((c: any) => ({ id: c.id, name: c.name, tagName: c.tags?.name ?? '' })),
    totalCount: (shopsData?.length ?? 0) + formattedProducts.length,
  }

  // 검색 로그 기록 (실패해도 검색 자체엔 영향 없음)
  try {
    await logSearch(query, userId ?? null, anonymousId ?? null, result, matchedTagIds[0], matchedCharacterIds[0], matchedGoodsTypeIds[0])
  } catch {}

  return result
}

async function logSearch(
  query: string,
  userId: string | null,
  anonymousId: string | null,
  result: GlobalSearchResult,
  matchedTagId?: string,
  matchedCharacterId?: string,
  matchedGoodsTypeId?: string
) {
  const supabase = createClient()
  await supabase.from('search_logs').insert({
    query,
    normalized_query: normalizeQuery(query),
    matched_tag_id: matchedTagId ?? null,
    matched_character_id: matchedCharacterId ?? null,
    matched_goods_type_id: matchedGoodsTypeId ?? null,
    result_count: result.totalCount,
    user_id: userId,
    anonymous_id: anonymousId,
  } as any)
}

export async function logSearchClick(searchQuery: string, targetType: string, targetId: string) {
  const supabase = createClient()
  // 가장 최근 검색 로그를 찾아서 클릭 기록 연결 (간단한 방식)
  const { data: recentLog } = await supabase
    .from('search_logs')
    .select('id')
    .eq('normalized_query', normalizeQuery(searchQuery))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentLog) {
    await supabase.from('search_click_logs').insert({
      search_log_id: recentLog.id,
      target_type: targetType,
      target_id: targetId,
    } as any)
  }
}