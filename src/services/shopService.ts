import { createClient } from '@/lib/supabase/client'
import { recordShopRegisterActivity } from '@/services/activityService'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'
import { resolveEventCover } from '@/lib/event/eventCover'
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
    // Place 연결 — 저장 좌표는 위(lat/lng) 그대로, 표시 좌표만 접는다
    place_id:       raw.place_id ?? null,
    floor:          raw.floor ?? null,
    unit:           raw.unit ?? null,
    place_name:     raw.places?.name ?? null,
    place_slug:     raw.places?.slug ?? null,
    displayLat:     raw.places?.lat ?? raw.lat,   // place 있으면 place 좌표
    displayLng:     raw.places?.lng ?? raw.lng,
    hasEvent:       false,       // getShops 후처리에서 채움
    eventTitle:     null,
    eventCover:     null,
    cat:            cats[0] ?? '기타',
    cats:           cats,
    images,
    hours:          raw.hours,
    parking:        raw.parking,
    parking_note:   raw.parking_note,
    shop_link:      raw.shop_link,
    sns_links:      raw.sns_links ?? [],
    phone:          raw.phone ?? null,
    floor_info:     raw.floor_info,
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
      place_id, floor, unit,
      places ( slug, name, lat, lng ),
      hours, parking, parking_note, shop_link, sns_links, phone,
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

  const shops = (data ?? []).map(toShop)
  return attachEvents(supabase, shops)
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      place_id, floor, unit,
      places ( slug, name, lat, lng ),
      hours, parking, parking_note, shop_link, sns_links, phone,
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
  // 입력어를 띄어쓰기로 쪼개, 각 단어가 (순서·띄어쓰기 무관) 이름에 모두 포함되면 매칭
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const supabase = createClient()

  let q = supabase
    .from('shops')
    .select(`
      id, slug, name, addr, lat, lng,
      rating_avg, rating_count, status,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .in('status', ['active', 'temporary_closed', 'closed'])

  // 여러 ilike를 걸면 AND로 묶임 → 모든 단어가 들어있는 샵만
  for (const token of tokens) {
    q = q.ilike('name', `%${token}%`)
  }

  const { data, error } = await q.limit(20)

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
): Promise<{ slug: string; id: string } | null> {
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
      sns_links:    data.sns_links ?? [],
      phone:        data.phone || null,
      floor_info:   data.floor_info || null,
      start_date:   data.start_date || null,
      end_date:     data.end_date || null,
      event_info:   data.event_info || null,
      place_id:     data.place_id || null,
      floor:        data.floor || null,
      unit:         data.unit || null,
      added_by:     userId,
      owner_id:     userId,
      status:       'active',
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

  // 성장 Activity — 샵 등록.
  // 카운터는 나중에 '아직 살아있는(active) 샵'만 세므로, 쓰레기 샵을 지우면 카운트도 빠진다
  try {
    await recordShopRegisterActivity({
      userId,
      shopId: shop.id,
      shopName: (data as any)?.name ?? '샵',
      shopSlug: shop.slug,
      region: ((data as any)?.region?.trim() || geekAreaFromAddr((data as any)?.addr ?? null)) ?? null,
    })
  } catch (e) {
    console.error('[샵 등록 Activity 실패]', e)
  }

  return { slug: shop.slug, id: shop.id }
}

export async function updateShop(
  shopId: string,
  data: any,
  userId: string
): Promise<boolean> {
  const supabase = createClient()

  // 변경 전 값 가져오기 (로그용)
  const { data: before } = await supabase
    .from('shops')
    .select('name, description, addr, lat, lng, hours, parking, parking_note, shop_link, sns_links, phone, start_date, end_date, event_info')
    .eq('id', shopId)
    .maybeSingle()

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  const isAdmin = (prof as any)?.role === 'admin'

  let updateQuery = supabase
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
      sns_links:    data.sns_links ?? [],
      phone:        data.phone || null,
      floor_info:   data.floor_info || null,
      start_date:   data.start_date || null,
      end_date:     data.end_date || null,
      event_info:   data.event_info || null,
      place_id:     data.place_id ?? null,
      floor:        data.floor ?? null,
      unit:         data.unit ?? null,
      info_last_confirmed_at: new Date().toISOString(),
      info_confirmed_by_type: isAdmin ? 'admin' : 'owner',
    } as any)
    .eq('id', shopId)
  if (!isAdmin) updateQuery = updateQuery.eq('owner_id', userId)
  const { error } = await updateQuery

  if (error) return false

  // 변경 이력 기록 (필드별로 실제 변경된 것만)
  if (before) {
    const { logChange } = await import('./shopChangeLogService')
    const fields: Record<string, any> = {
      name: data.name, description: data.description, addr: data.addr,
      hours: data.hours, parking: data.parking, parking_note: data.parking_note,
      shop_link: data.shop_link, floor_info: data.floor_info,
    }
    function normalize(v: any) {
      if (v === '' || v === undefined) return null
      return v
    }

    for (const [field, newVal] of Object.entries(fields)) {
      const oldVal = (before as any)[field]
      if (JSON.stringify(normalize(oldVal)) !== JSON.stringify(normalize(newVal))) {
        await logChange({
          shopId, targetTable: 'shops', fieldName: field,
          oldValue: oldVal, newValue: newVal,
          changeSource: 'owner', changedBy: userId, reason: 'owner_update',
        })
      }
    }
  }

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

// 진행 중 이벤트의 포스터를 각 샵에 붙인다 (지도·바텀시트 카드 이미지용)
async function attachEvents(supabase: any, shops: Shop[]): Promise<Shop[]> {
  if (shops.length === 0) return shops
  const today = new Date().toISOString().slice(0, 10)
  const ids = shops.map(s => s.id)

  const { data: evs } = await supabase
    .from('events')
    .select('shop_id, title, cover_url, tag_id, start_date, end_date')
    .in('shop_id', ids)
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (!evs || evs.length === 0) return shops

  // 작품 커버 폴백용 tags
  const tagIds = [...new Set(evs.map((e: any) => e.tag_id).filter(Boolean))]
  const tagCover = new Map<string, string | null>()
  if (tagIds.length) {
    const { data: tags } = await supabase.from('tags').select('id, cover_url').in('id', tagIds)
    for (const tg of (tags ?? []) as any[]) tagCover.set(tg.id, tg.cover_url ?? null)
  }

  // 샵별 첫 이벤트만
  const byShop = new Map<string, any>()
  for (const e of evs as any[]) if (!byShop.has(e.shop_id)) byShop.set(e.shop_id, e)

  return shops.map(s => {
    const e = byShop.get(s.id)
    if (!e) return s
    return {
      ...s,
      hasEvent: true,
      eventTitle: e.title ?? null,
      eventCover: resolveEventCover({
        eventCoverUrl: e.cover_url ?? null,
        workCoverUrl: e.tag_id ? (tagCover.get(e.tag_id) ?? null) : null,
      }),
    }
  })
}

export async function getShopsByTag(tagSlug: string): Promise<Shop[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shop_tags')
    .select(`
      tags!inner ( slug ),
      shops!inner (
        id, slug, name, description,
        addr, country, region, city, district,
        lat, lng, google_place_id,
        place_id, floor, unit,
        places ( slug, name, lat, lng ),
        hours, parking, parking_note, shop_link, sns_links, phone,
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
    .select('id, name, slug, created_at, cover_url, banner_image, english_name, ip_type, release_year, genres, description')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

export async function getAllTags() {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name, slug, cover_url, banner_image, english_name, ip_type, release_year, genres, description, created_at')
    .order('name')
  return data ?? []
}

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

export async function getPendingShops(): Promise<Shop[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      place_id, floor, unit,
      places ( slug, name, lat, lng ),
      hours, parking, parking_note, shop_link, sns_links, phone,
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

export async function approveShop(shopId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shops')
    .update({ status: 'active', is_verified: true } as any)
    .eq('id', shopId)
  return !error
}

export async function rejectShop(shopId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shops')
    .update({ status: 'hidden' } as any)
    .eq('id', shopId)
  return !error
}

export async function getPendingVerifyRequests() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shop_verify_requests')
    .select(`
      id, shop_id, user_id, note, evidence_url, status, created_at,
      shops ( id, name, slug ),
      profiles!shop_verify_requests_user_id_fkey ( id, nickname )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getPendingVerifyRequests error:', JSON.stringify(error))
    return []
  }
  return data ?? []
}

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

export async function rejectVerifyRequest(requestId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_verify_requests')
    .update({ status: 'rejected' } as any)
    .eq('id', requestId)
  return !error
}

export async function getEvidenceFileUrl(path: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('verify-documents')
    .createSignedUrl(path, 60 * 5)

  if (error) return null
  return data.signedUrl
}

// 내가 등록한 샵 목록 (마이페이지용)
export async function getMyShops(userId: string): Promise<Shop[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      place_id, floor, unit,
      places ( slug, name, lat, lng ),
      hours, parking, parking_note, shop_link, sns_links, phone,
      start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      added_by, owner_id, created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('added_by', userId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []).map(toShop)
}

// 내가 찜한 샵 전체 (saved_shops JOIN shops)
export async function getSavedShops(userId: string): Promise<Shop[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('saved_shops')
    .select(`
      shops (
        id, slug, name, description,
        addr, country, region, city, district,
        lat, lng, google_place_id,
        place_id, floor, unit,
        places ( slug, name, lat, lng ),
        hours, parking, parking_note, shop_link, sns_links, phone,
        start_date, end_date, event_info,
        rating_avg, rating_count, visit_count, bookmark_count,
        is_verified, is_claimed, status,
        added_by, owner_id, created_at, updated_at,
        shop_images ( image_url, is_cover, sort_order ),
        shop_categories ( categories ( name, slug, color, icon, bg_color ) )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? [])
    .map((d: any) => d.shops)
    .filter(Boolean)
    .map(toShop)
}

// 내 인증 신청 전체 현황
export async function getMyVerifyRequests(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shop_verify_requests')
    .select(`
      id, status, note, created_at,
      shops ( id, name, slug )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

// 닉네임 변경
export async function updateNickname(userId: string, nickname: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('nickname', nickname)
    .neq('id', userId)
    .maybeSingle()

  if (existing) return { ok: false, error: '이미 사용 중인 닉네임이에요' }

  const { error } = await supabase
    .from('profiles')
    .update({ nickname } as any)
    .eq('id', userId)

  return { ok: !error }
}

// 계정 탈퇴 (soft delete 방식 — profiles는 유지, 관련 데이터 정리)
export async function deleteShop(shopId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  const isAdmin = (prof as any)?.role === 'admin'
  let q = supabase.from('shops').delete().eq('id', shopId)
  if (!isAdmin) q = q.eq('owner_id', userId)
  const { error } = await q
  if (error) { console.error('[샵 삭제 실패]', error.message, error.code); return false }
  return true
}

export async function deleteAccount(userId: string): Promise<boolean> {
  const supabase = createClient()

  // 내가 등록한 샵 → added_by/owner_id 유지하되 익명화는 운영 정책에 따라 추후 결정
  // 일단은 auth 계정 자체를 삭제 (Supabase Auth는 클라이언트에서 자기 계정 삭제 불가하므로
  // 별도 RPC 또는 관리자 처리 필요 — 여기서는 profiles 비활성화로 대체)
  const { error } = await supabase
    .from('profiles')
    .update({ nickname: `삭제된사용자_${userId.slice(0, 8)}` } as any)
    .eq('id', userId)

  if (error) return false

  await supabase.auth.signOut()
  return true
}

export async function uploadShopMainImage(file: File, shopSlug: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `${shopSlug}/main/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('shop-images')
    .upload(path, file)

  if (error) return null

  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}

export async function setShopMainImage(shopId: string, imageUrl: string): Promise<boolean> {
  const supabase = createClient()

  // 기존 대표사진(is_cover=true)을 전부 삭제
  await supabase.from('shop_images').delete().eq('shop_id', shopId).eq('is_cover', true)

  // 새 이미지를 대표사진으로 추가
  const { error } = await supabase
    .from('shop_images')
    .insert({ shop_id: shopId, image_url: imageUrl, is_cover: true, sort_order: 0 } as any)

  return !error
}
