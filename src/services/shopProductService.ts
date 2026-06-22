import { createClient } from '@/lib/supabase/client'

export type Availability = 'unknown' | 'not_sold' | 'sold_out' | 'few' | 'normal' | 'many'

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  unknown: '확인 안 됨',
  not_sold: '판매 안 함',
  sold_out: '품절',
  few: '소량',
  normal: '보통',
  many: '많음',
}

export const AVAILABILITY_SCORE: Record<Availability, number> = {
  unknown: 0, not_sold: 0, sold_out: 10, few: 40, normal: 60, many: 90,
}

export function buildProductSlug(tagSlug: string, characterSlug: string | null, goodsTypeSlug: string, variantSlug?: string | null): string {
  return [tagSlug, characterSlug, goodsTypeSlug, variantSlug].filter(Boolean).join('-')
}

// 샵의 취급 작품 목록 (1단계, 가벼운 입력)
export async function getShopTags(shopId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_tags')
    .select('tag_id, tags ( id, name, slug )')
    .eq('shop_id', shopId)
  return (data ?? []).map((d: any) => d.tags).filter(Boolean)
}

export async function updateShopTags(shopId: string, tagIds: string[]): Promise<boolean> {
  const supabase = createClient()
  await supabase.from('shop_tags').delete().eq('shop_id', shopId)
  if (tagIds.length === 0) return true
  const { error } = await supabase
    .from('shop_tags')
    .insert(tagIds.map(tagId => ({ shop_id: shopId, tag_id: tagId })) as any)
  return !error
}

// 작품별 굿즈 상세 (2단계)
export async function getShopProductsBySeries(shopId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_products')
    .select(`
      id, availability, source, confirm_count, last_confirmed_at, confirmed_by_type,
      variant_name,
      tags ( id, name, slug ),
      characters ( id, name, slug ),
      goods_types ( id, name, slug, icon ),
      shop_product_images ( id, image_url, image_type )
    `)
    .eq('shop_id', shopId)
    .eq('is_active', true)

  if (!data) return []

  const grouped = new Map<string, any>()
  for (const row of data as any[]) {
    const tagId = row.tags?.id
    if (!tagId) continue
    if (!grouped.has(tagId)) {
      grouped.set(tagId, { tagId, tagName: row.tags.name, tagSlug: row.tags.slug, goodsList: [] })
    }
    grouped.get(tagId).goodsList.push({
      id: row.id,
      goodsTypeId: row.goods_types?.id,
      goodsTypeName: row.goods_types?.name,
      goodsTypeIcon: row.goods_types?.icon,
      characterName: row.characters?.name ?? null,
      variantName: row.variant_name,
      availability: row.availability,
      confirmCount: row.confirm_count,
      lastConfirmedAt: row.last_confirmed_at,
      confirmedByType: row.confirmed_by_type,
      images: row.shop_product_images ?? [],
    })
  }

  return Array.from(grouped.values())
}

// 작품×굿즈 등록/수정 (upsert)
export async function upsertShopProduct(params: {
  shopId: string
  tagId: string
  goodsTypeId: string
  characterId?: string | null
  variantName?: string | null
  variantSlug?: string | null
  availability: Availability
  source: 'owner' | 'admin' | 'user'
  confirmedByType: 'owner' | 'admin' | 'user_report'
  userId: string
}): Promise<boolean> {
  const supabase = createClient()

  let query = supabase
    .from('shop_products')
    .select('id, availability')
    .eq('shop_id', params.shopId)
    .eq('tag_id', params.tagId)
    .eq('goods_type_id', params.goodsTypeId)

  if (params.variantSlug) {
    query = query.eq('variant_slug', params.variantSlug)
  } else {
    query = query.is('variant_slug', null)
  }

  const { data: existing } = await query.maybeSingle()

  const payload = {
    shop_id: params.shopId,
    tag_id: params.tagId,
    goods_type_id: params.goodsTypeId,
    character_id: params.characterId ?? null,
    variant_name: params.variantName ?? null,
    variant_slug: params.variantSlug ?? null,
    availability: params.availability,
    source: params.source,
    confirmed_by_type: params.confirmedByType,
    confirmed_by_user_id: params.userId,
    last_confirmed_at: new Date().toISOString(),
  }

  const { logChange } = await import('./shopChangeLogService')

  if (existing) {
    const { error } = await supabase
      .from('shop_products')
      .update(payload as any)
      .eq('id', existing.id)

    if (!error && existing.availability !== params.availability) {
      await logChange({
        shopId: params.shopId, targetTable: 'shop_products', targetId: existing.id,
        fieldName: 'availability',
        oldValue: existing.availability, newValue: params.availability,
        changeSource: params.source === 'owner' ? 'owner' : params.source === 'admin' ? 'admin' : 'user_suggestion',
        changedBy: params.userId,
      })
    }
    return !error
  } else {
    const { data: created, error } = await supabase
      .from('shop_products')
      .insert(payload as any)
      .select('id')
      .single()

    if (!error && created) {
      await logChange({
        shopId: params.shopId, targetTable: 'shop_products', targetId: created.id,
        fieldName: 'availability',
        oldValue: null, newValue: params.availability,
        changeSource: params.source === 'owner' ? 'owner' : params.source === 'admin' ? 'admin' : 'user_suggestion',
        changedBy: params.userId,
      })
    }
    return !error
  }
}

// 전체 굿즈 타입 목록 (입력 폼용)
export async function getAllGoodsTypes() {
  const supabase = createClient()
  const { data } = await supabase.from('goods_types').select('*').order('sort_order')
  return data ?? []
}

// 캐릭터 목록 (작품별)
export async function getCharactersByTag(tagId: string) {
  const supabase = createClient()
  const { data } = await supabase.from('characters').select('*').eq('tag_id', tagId).order('name')
  return data ?? []
}

// 미방문/미등록 굿즈 검색 (사이트 전역 검색용 — Step 32에서 본격 사용)
export async function searchProductsAcrossShops(query: string) {
  const supabase = createClient()
  const term = query.trim()
  if (!term) return []

  const { data } = await supabase
    .from('shop_products')
    .select(`
      id, availability, last_confirmed_at, confirmed_by_type, confirm_count,
      shops ( id, name, slug ),
      tags ( name ),
      characters ( name ),
      goods_types ( name ),
      shop_product_images ( image_url )
    `)
    .eq('is_active', true)
    .or(`tags.name.ilike.%${term}%,characters.name.ilike.%${term}%,goods_types.name.ilike.%${term}%`)
    .limit(30)

  return data ?? []
}

// 샵 전체의 취급 분야 (작품 무관, 간단한 칩 선택)
export async function getShopGoodsCategories(shopId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_goods_categories')
    .select('goods_type_id')
    .eq('shop_id', shopId)
  return (data ?? []).map((d: any) => d.goods_type_id)
}

export async function updateShopGoodsCategories(shopId: string, goodsTypeIds: string[]): Promise<boolean> {
  const supabase = createClient()
  await supabase.from('shop_goods_categories').delete().eq('shop_id', shopId)
  if (goodsTypeIds.length === 0) return true
  const { error } = await supabase
    .from('shop_goods_categories')
    .insert(goodsTypeIds.map(id => ({ shop_id: shopId, goods_type_id: id })) as any)
  return !error
}

// 특정 작품의 모든 굿즈를 비활성화 (취급 작품에서 제외할 때 사용)
export async function deactivateProductsByTag(shopId: string, tagId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_products')
    .update({ is_active: false, deactivated_at: new Date().toISOString() } as any)
    .eq('shop_id', shopId)
    .eq('tag_id', tagId)
  return !error
}