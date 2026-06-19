import { createClient } from '@/lib/supabase/client'
import { Shop } from '@/types/shop'

export function toShop(raw: any): Shop {
  const cats = (raw.shop_categories ?? [])
    .map((sc: any) => sc.categories?.name)
    .filter(Boolean) as string[]

  const images = (raw.shop_images ?? [])
    .sort((a: any, b: any) => {
      if (a.is_cover && !b.is_cover) return -1
      if (!a.is_cover && b.is_cover) return 1
      return a.sort_order - b.sort_order
    })
    .map((img: any) => img.image_url) as string[]

  return {
    id:             raw.id,
    slug:           raw.slug,
    name:           raw.name,
    description:    raw.description,
    addr:           raw.addr,
    country:        raw.country ?? 'KR',
    region:         raw.region,
    city:           raw.city,
    district:       raw.district,
    lat:            raw.lat,
    lng:            raw.lng,
    google_place_id: raw.google_place_id,
    cat:            cats[0] ?? '기타',
    cats:           cats,
    images,
    hours:          raw.hours,
    parking:        raw.parking,
    parking_note:   raw.parking_note,
    shop_link:      raw.shop_link,
    start_date:     raw.start_date,
    end_date:       raw.end_date,
    event_info:     raw.event_info,
    rating_avg:     raw.rating_avg ?? 0,
    rating_count:   raw.rating_count ?? 0,
    visit_count:    raw.visit_count ?? 0,
    bookmark_count: raw.bookmark_count ?? 0,
    is_verified:    raw.is_verified ?? false,
    is_claimed:     raw.is_claimed ?? false,
    status:         raw.status,
    added_by:       raw.added_by,
    owner_id:       raw.owner_id,
    created_at:     raw.created_at,
    updated_at:     raw.updated_at,
  }
}

export async function getShops(): Promise<Shop[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      hours, parking, parking_note, shop_link,
      start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      added_by, owner_id,
      created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getShops error:', error)
    return []
  }

  return (data ?? []).map(toShop)
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      hours, parking, parking_note, shop_link,
      start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      added_by, owner_id,
      created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) return null
  return toShop(data)
}

export async function searchShops(query: string): Promise<Shop[]> {
  if (!query.trim()) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, addr, lat, lng,
      rating_avg, rating_count, status,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('status', 'active')
    .ilike('name', `%${query}%`)
    .limit(20)

  if (error) return []
  return (data ?? []).map(toShop)
}

export async function incrementVisit(shopId: string): Promise<void> {
  const supabase = createClient()
  await (supabase as any).rpc('increment_visit_count', { p_shop_id: shopId })
}

export async function saveBookmark(shopId: string, userId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('saved_shops')
    .insert({ shop_id: shopId, user_id: userId } as any)
}

export async function removeBookmark(shopId: string, userId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('saved_shops')
    .delete()
    .eq('shop_id', shopId)
    .eq('user_id', userId)
}

export async function getSavedShopIds(userId: string): Promise<string[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from('saved_shops')
    .select('shop_id')
    .eq('user_id', userId)

  return (data ?? []).map((d: any) => d.shop_id)
}

export async function createShop(
  data: any,
  userId: string
): Promise<{ slug: string } | null> {
  const supabase = createClient()

  const { data: shop, error } = await supabase
    .from('shops')
    .insert({
      slug:         data.slug,
      name:         data.name,
      description:  data.description || null,
      addr:         data.addr || null,
      lat:          data.lat,
      lng:          data.lng,
      hours:        data.hours,
      parking:      data.parking,
      parking_note: data.parking_note || null,
      shop_link:    data.shop_link || null,
      start_date:   data.start_date || null,
      end_date:     data.end_date || null,
      event_info:   data.event_info || null,
      added_by:     userId,
      owner_id:     userId,
      status:       'pending',
    } as any)
    .select('slug, id')
    .single()

  if (error || !shop) return null

  if (data.cats.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .in('name', data.cats)

    if (cats && cats.length > 0) {
      await supabase
        .from('shop_categories')
        .insert(cats.map((c: any) => ({ shop_id: shop.id, category_id: c.id })) as any)
    }
  }

  return { slug: shop.slug }
}

export async function updateShop(
  shopId: string,
  data: any,
  userId: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('shops')
    .update({
      name:         data.name,
      description:  data.description || null,
      addr:         data.addr || null,
      lat:          data.lat,
      lng:          data.lng,
      hours:        data.hours,
      parking:      data.parking,
      parking_note: data.parking_note || null,
      shop_link:    data.shop_link || null,
      start_date:   data.start_date || null,
      end_date:     data.end_date || null,
      event_info:   data.event_info || null,
    } as any)
    .eq('id', shopId)
    .eq('owner_id', userId)

  if (error) return false

  await supabase.from('shop_categories').delete().eq('shop_id', shopId)

  if (data.cats.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .in('name', data.cats)

    if (cats && cats.length > 0) {
      await supabase
        .from('shop_categories')
        .insert(cats.map((c: any) => ({ shop_id: shopId, category_id: c.id })) as any)
    }
  }

  return true
}

// 태그별 샵 목록
export async function getShopsByTag(tagSlug: string): Promise<Shop[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shop_tags')
    .select(`
      shops (
        id, slug, name, description,
        addr, country, region, city, district,
        lat, lng, google_place_id,
        hours, parking, parking_note, shop_link,
        start_date, end_date, event_info,
        rating_avg, rating_count, visit_count, bookmark_count,
        is_verified, is_claimed, status,
        added_by, owner_id, created_at, updated_at,
        shop_images ( image_url, is_cover, sort_order ),
        shop_categories ( categories ( name, slug, color, icon, bg_color ) )
      )
    `)
    .eq('tags.slug', tagSlug)
    .eq('shops.status', 'active')

  if (error) return []
  return (data ?? [])
    .map((d: any) => d.shops)
    .filter(Boolean)
    .map(toShop)
}

export async function getTagBySlug(slug: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name, slug, created_at')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

export async function getAllTags() {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name, slug, created_at')
    .order('name')
  return data ?? []
}

// 샵 주인 인증 신청 (파일 업로드 포함)
export async function requestShopVerify(
  shopId: string,
  userId: string,
  note: string,
  file: File | null
): Promise<boolean> {
  const supabase = createClient()
  let evidenceUrl: string | null = null

  if (file) {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${shopId}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('verify-documents')
      .upload(path, file)

    if (!uploadError) {
      evidenceUrl = path
    }
  }

  const { error } = await supabase
    .from('shop_verify_requests')
    .insert({
      shop_id: shopId,
      user_id: userId,
      note,
      evidence_url: evidenceUrl,
    } as any)

  return !error
}

export async function getMyVerifyRequest(shopId: string, userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_verify_requests')
    .select('id, status, note, evidence_url, created_at')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// === 관리자 전용 함수 ===

// 승인 대기 샵 목록
export async function getPendingShops(): Promise<Shop[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      hours, parking, parking_note, shop_link,
      start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      added_by, owner_id, created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []).map(toShop)
}

// 샵 승인
export async function approveShop(shopId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shops')
    .update({ status: 'active', is_verified: true } as any)
    .eq('id', shopId)
  return !error
}

// 샵 거절 (숨김 처리)
export async function rejectShop(shopId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shops')
    .update({ status: 'hidden' } as any)
    .eq('id', shopId)
  return !error
}

// 인증 신청 대기 목록 (샵 정보 + 신청자 정보 포함)
export async function getPendingVerifyRequests() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shop_verify_requests')
    .select(`
      id, shop_id, user_id, note, evidence_url, status, created_at,
      shops ( id, name, slug ),
      profiles ( id, nickname )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

// 인증 신청 승인
export async function approveVerifyRequest(requestId: string, shopId: string, userId: string): Promise<boolean> {
  const supabase = createClient()

  const { error: reqError } = await supabase
    .from('shop_verify_requests')
    .update({ status: 'approved' } as any)
    .eq('id', requestId)

  if (reqError) return false

  const { error: shopError } = await supabase
    .from('shops')
    .update({ is_claimed: true, owner_id: userId } as any)
    .eq('id', shopId)

  return !shopError
}

// 인증 신청 거절
export async function rejectVerifyRequest(requestId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_verify_requests')
    .update({ status: 'rejected' } as any)
    .eq('id', requestId)
  return !error
}

// 인증 증빙파일 URL 가져오기 (private 버킷이라 signed URL 필요)
export async function getEvidenceFileUrl(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('verify-documents')
    .createSignedUrl(path, 60 * 5) // 5분간 유효

  if (error) return null
  return data.signedUrl
}