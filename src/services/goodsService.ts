import { createClient } from '@/lib/supabase/client'
import { createPost } from './communityPostService'

/* ============================================================
   내 굿즈 / 작품별 자동 컬렉션 서비스 (Phase 1 — 본인 데이터)
   - 조회는 전부 SECURITY DEFINER RPC(get_goods_*)를 통해 can_view_goods 적용
   - 이미지: goods(비공개 goods-images)는 본인 폴더 서명 URL, community(shop-images)는 public URL, external은 https
   ⚠️ 타인 굿즈 서명은 Phase 3에서 서버(service-role) 라우트로 처리. 여기선 본인 전용.
   ============================================================ */

const SIGN_TTL = 60 * 30 // 30분

export type GoodsVisibility = 'public' | 'followers' | 'private'
export type StorageOwner = 'goods' | 'community' | 'external'

export interface GoodsCover {
  imageId: string | null
  storageOwner: StorageOwner | null
  bucket: string | null
  path: string | null
  external: string | null
  url: string | null            // 최종 표시 URL(서명/공개/외부)
}

export interface GoodsListItem {
  id: string
  ownerId: string
  workId: string | null
  workName: string | null
  workSlug: string | null
  workCoverUrl: string | null    // 작품 대표 이미지(공개). 굿즈 사진 없을 때 fallback 용
  goodsTypeId: string | null
  goodsTypeName: string | null
  name: string | null
  characterName: string | null
  price: number | null
  pricePublic: boolean
  visibility: GoodsVisibility
  createdAt: string
  cover: GoodsCover
  isFromCommunity: boolean
}

export interface GoodsCollection {
  workId: string | null         // null = 작품 미지정
  workName: string | null
  workSlug: string | null
  coverUrl: string | null       // tags.cover_url (작품 대표 이미지, 공개)
  itemCount: number
  recentCovers: (string | null)[]  // 최근 굿즈 4장 표시 URL
}

export interface GoodsType {
  id: string
  name: string
  slug: string | null
  icon: string | null
  isCollectible: boolean
}

/* ── 서명/URL 해석 (본인 이미지 전용) ─────────────────────────
   goods-images 경로들을 한 번에 서명하고, community는 public URL, external은 그대로. */
type RawCover = { imageId: string | null; storageOwner: StorageOwner | null; bucket: string | null; path: string | null; external: string | null }

async function resolveCovers(covers: RawCover[]): Promise<Map<number, string | null>> {
  const supabase = createClient()
  const out = new Map<number, string | null>()
  const goodsToSign: { idx: number; path: string }[] = []

  covers.forEach((c, idx) => {
    if (!c) { out.set(idx, null); return }
    if (c.storageOwner === 'goods' && c.bucket === 'goods-images' && c.path) {
      goodsToSign.push({ idx, path: c.path })
    } else if (c.storageOwner === 'community' && c.bucket === 'shop-images' && c.path) {
      const { data } = supabase.storage.from('shop-images').getPublicUrl(c.path)
      out.set(idx, data.publicUrl ?? null)
    } else if (c.storageOwner === 'external' && c.external && c.external.startsWith('https://')) {
      out.set(idx, c.external)
    } else {
      out.set(idx, null)
    }
  })

  if (goodsToSign.length > 0) {
    const paths = goodsToSign.map(g => g.path)
    const { data, error } = await supabase.storage.from('goods-images').createSignedUrls(paths, SIGN_TTL)
    if (error) {
      goodsToSign.forEach(g => out.set(g.idx, null))
    } else {
      // data 순서는 요청 순서와 매칭
      ;(data ?? []).forEach((d, i) => {
        const g = goodsToSign[i]
        out.set(g.idx, d?.signedUrl ?? null)
      })
    }
  }
  return out
}

/* ── 내 굿즈 목록 (필터·정렬·커서 페이지네이션) ── */
export interface GoodsListParams {
  workId?: string | null
  typeId?: string | null
  onlyUnassigned?: boolean
  search?: string | null
  visibility?: GoodsVisibility | null
  order?: 'recent' | 'old'
  before?: string | null   // created_at 커서(ISO)
  limit?: number
}

export async function getMyGoods(params: GoodsListParams = {}): Promise<{ items: GoodsListItem[]; nextCursor: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { items: [], nextCursor: null }
  const limit = params.limit ?? 30

  const { data, error } = await supabase.rpc('get_goods_list', {
    p_owner: user.id,
    p_work: params.workId ?? null,
    p_type: params.typeId ?? null,
    p_only_unassigned: params.onlyUnassigned ?? false,
    p_before: params.before ?? null,
    p_limit: limit,
    p_search: params.search?.trim() || null,
    p_visibility: params.visibility ?? null,
    p_order: params.order ?? 'recent',
  })
  if (error) throw error
  const rows: any[] = data ?? []

  const covers: RawCover[] = rows.map(r => ({
    imageId: r.cover_image_id ?? null, storageOwner: r.cover_storage_owner ?? null,
    bucket: r.cover_bucket ?? null, path: r.cover_path ?? null, external: r.cover_external ?? null,
  }))
  const urls = await resolveCovers(covers)

  const items: GoodsListItem[] = rows.map((r, i) => ({
    id: r.id, ownerId: r.owner_id,
    workId: r.work_id ?? null, workName: r.work_name ?? null, workSlug: r.work_slug ?? null,
    workCoverUrl: r.work_cover_url ?? null,
    goodsTypeId: r.goods_type_id ?? null, goodsTypeName: r.goods_type_name ?? null,
    name: r.name ?? null, characterName: r.character_name ?? null,
    price: r.price ?? null, pricePublic: !!r.price_public,
    visibility: (r.visibility ?? 'public') as GoodsVisibility,
    createdAt: r.created_at,
    cover: { ...covers[i], url: urls.get(i) ?? null },
    isFromCommunity: !!r.is_from_community,
  }))

  const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null
  return { items, nextCursor }
}

/* ── 작품별 자동 컬렉션 목록 ── */
export async function getMyGoodsCollections(ownerId?: string): Promise<GoodsCollection[]> {
  const supabase = createClient()
  let owner = ownerId
  if (!owner) { const { data: { user } } = await supabase.auth.getUser(); owner = user?.id }
  if (!owner) return []

  const { data, error } = await supabase.rpc('get_goods_collections', { p_owner: owner })
  if (error) throw error
  const rows: any[] = data ?? []

  // 모든 컬렉션의 recent_covers를 평탄화해 한 번에 서명
  const flat: RawCover[] = []
  const spans: { start: number; len: number }[] = []
  for (const r of rows) {
    const arr: any[] = Array.isArray(r.recent_covers) ? r.recent_covers : []
    spans.push({ start: flat.length, len: arr.length })
    for (const c of arr) {
      flat.push({
        imageId: c.id ?? null, storageOwner: c.storage_owner ?? null,
        bucket: c.bucket ?? null, path: c.path ?? null, external: c.external ?? null,
      })
    }
  }
  const urls = await resolveCovers(flat)

  return rows.map((r, i): GoodsCollection => {
    const { start, len } = spans[i]
    const recent: (string | null)[] = []
    for (let k = 0; k < len; k++) recent.push(urls.get(start + k) ?? null)
    return {
      workId: r.work_id ?? null,
      workName: r.work_name ?? null,
      workSlug: r.work_slug ?? null,
      coverUrl: r.cover_url ?? null,
      itemCount: Number(r.item_count) || 0,
      recentCovers: recent,
    }
  })
}

/* ── 컬렉션 대표 이미지(goods_collection_covers) ── */
// 내 컬렉션별 대표 굿즈 id 맵 { work_id: cover_item_id }
export async function getCollectionCovers(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const { data } = await supabase.from('goods_collection_covers').select('work_id, cover_item_id')
  const map: Record<string, string> = {}
  for (const r of (data ?? []) as any[]) map[r.work_id] = r.cover_item_id
  return map
}

// 굿즈 id들의 대표(첫) 이미지 표시 URL 맵 { goods_item_id: url } — 서버 서명 규칙 재사용
export async function resolveGoodsItemCovers(itemIds: string[]): Promise<Record<string, string | null>> {
  const supabase = createClient()
  const ids = Array.from(new Set(itemIds.filter(Boolean)))
  if (ids.length === 0) return {}
  const { data } = await supabase.from('goods_item_images')
    .select('goods_item_id, storage_owner, bucket_name, object_path, external_url, sort_order')
    .in('goods_item_id', ids)
    .order('sort_order', { ascending: true })
  const first: Record<string, any> = {}
  for (const r of (data ?? []) as any[]) { if (!(r.goods_item_id in first)) first[r.goods_item_id] = r }
  const keys = Object.keys(first)
  const covers: RawCover[] = keys.map(k => ({
    imageId: null, storageOwner: first[k].storage_owner ?? null, bucket: first[k].bucket_name ?? null,
    path: first[k].object_path ?? null, external: first[k].external_url ?? null,
  }))
  const urls = await resolveCovers(covers)
  const out: Record<string, string | null> = {}
  keys.forEach((k, i) => { out[k] = urls.get(i) ?? null })
  return out
}

// 대표 이미지 지정(upsert) — RLS: 본인 굿즈 + 같은 작품만
export async function setCollectionCover(workId: string, coverItemId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요해요')
  const { error } = await supabase.from('goods_collection_covers')
    .upsert({ owner_id: user.id, work_id: workId, cover_item_id: coverItemId }, { onConflict: 'owner_id,work_id' })
  if (error) throw error
}

/* ── 프로필 굿즈 카운트(굿즈 수·컬렉션 수) ── */
export async function getMyGoodsCounts(ownerId?: string): Promise<{ goodsCount: number; collectionCount: number; thisMonthCount: number }> {
  const supabase = createClient()
  let owner = ownerId
  if (!owner) { const { data: { user } } = await supabase.auth.getUser(); owner = user?.id }
  if (!owner) return { goodsCount: 0, collectionCount: 0, thisMonthCount: 0 }
  const { data, error } = await supabase.rpc('get_goods_counts', { p_owner: owner })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    goodsCount: Number(row?.goods_count) || 0,
    collectionCount: Number(row?.collection_count) || 0,
    thisMonthCount: Number(row?.this_month_count) || 0,
  }
}

/* 이 글에 연결된, 뷰어가 볼 수 있는 굿즈 목록 (get_post_goods: can_view_post + can_view_goods) */
export interface PostGoods { id: string; ownerId: string; name: string | null; coverUrl: string | null; visibility: GoodsVisibility }
export async function getPostGoods(postId: string): Promise<PostGoods[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_post_goods', { p_post: postId })
  if (error) throw error
  const rows: any[] = data ?? []
  const covers: RawCover[] = rows.map(r => ({
    imageId: r.cover_image_id ?? null, storageOwner: r.cover_storage_owner ?? null,
    bucket: r.cover_bucket ?? null, path: r.cover_path ?? null, external: r.cover_external ?? null,
  }))
  const urls = await resolveCovers(covers)
  return rows.map((r, i): PostGoods => ({
    id: r.id, ownerId: r.owner_id, name: r.name ?? null,
    coverUrl: urls.get(i) ?? null, visibility: (r.visibility ?? 'public') as GoodsVisibility,
  }))
}

/* 이 굿즈가 연결된 커뮤니티 글 id (post_goods_links, RLS 본인 굿즈만). 없으면 null */
export async function getGoodsPostId(goodsItemId: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('post_goods_links')
    .select('post_id, created_at')
    .eq('goods_item_id', goodsItemId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as any)?.post_id ?? null
}

/* 이 글에 연결된 내 굿즈 id (편집 시 캐릭터·태그 프리필/재저장용) */
export async function getPostGoodsId(postId: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('post_goods_links')
    .select('goods_item_id, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as any)?.goods_item_id ?? null
}

/* 굿즈 일부 필드만 갱신(이름·캐릭터·태그) — 컬럼 화이트리스트 내, RLS 본인 전용 */
export async function updateGoodsMeta(id: string, patch: { name?: string | null; characterName?: string | null; goodsTypeId?: string | null; store?: string | null; price?: number | null; tags?: string[] }): Promise<void> {
  const supabase = createClient()
  const p: Record<string, any> = {}
  if ('name' in patch) p.name = patch.name?.trim() || null
  if ('characterName' in patch) p.character_name = patch.characterName?.trim() || null
  if ('goodsTypeId' in patch) p.goods_type_id = patch.goodsTypeId ?? null
  if ('store' in patch) p.store = patch.store?.trim() || null
  if ('price' in patch) p.price = patch.price ?? null
  if ('tags' in patch) p.tags = normalizeTags(patch.tags ?? [])
  if (Object.keys(p).length === 0) return
  const { error } = await supabase.from('goods_items').update(p).eq('id', id)
  if (error) throw error
}

/* 공개범위만 변경(더보기 메뉴) — 컬럼 화이트리스트에 visibility 포함, RLS 본인 전용 */
export async function setGoodsVisibility(id: string, visibility: GoodsVisibility): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('goods_items').update({ visibility }).eq('id', id)
  if (error) throw error
}

/* ── 종류 카탈로그(필터용) ── */
export async function getGoodsTypes(): Promise<GoodsType[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('goods_types')
    .select('id, name, slug, icon, is_collectible, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, slug: r.slug ?? null, icon: r.icon ?? null, isCollectible: !!r.is_collectible,
  }))
}

/* ============================================================
   등록 / 편집 / 삭제 (Phase 2)
   - 이미지: 클라에서 EXIF 제거(canvas 재인코딩→webp) 후 goods-images/{uid}/ 업로드
   - 본인 업로드는 항상 storage_owner='goods'. community/external은 서버/RPC 경로(Phase 4)
   ============================================================ */

export interface GoodsImageDetail { id: string; storageOwner: StorageOwner; bucket: string | null; path: string | null; external: string | null; sort: number; url: string | null }
export interface GoodsDetail {
  id: string; ownerId: string
  workId: string | null; workName: string | null; workSlug: string | null
  goodsTypeId: string | null; goodsTypeName: string | null
  name: string | null; characterName: string | null
  store: string | null; purchasedOn: string | null; memo: string | null
  price: number | null; pricePublic: boolean
  visibility: GoodsVisibility; createdAt: string; updatedAt: string
  tags: string[]
  images: GoodsImageDetail[]; isFromCommunity: boolean
}

export interface WorkRef { id: string; name: string; slug: string | null }

/* 작품(태그) 검색 — 등록 폼의 작품 선택 */
export async function searchWorks(query: string): Promise<WorkRef[]> {
  const supabase = createClient()
  let q = supabase.from('tags').select('id, name, slug').order('name', { ascending: true }).limit(20)
  const term = query.trim()
  if (term) q = q.ilike('name', `%${term}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, slug: r.slug ?? null }))
}

/* 이미지 EXIF 제거 + 리사이즈 → webp Blob (브라우저) */
export async function processImageToWebp(file: File, maxSize = 1600, quality = 0.9): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap
  if (width > maxSize || height > maxSize) {
    const scale = maxSize / Math.max(width, height)
    width = Math.round(width * scale); height = Math.round(height * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 컨텍스트 실패')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const blob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), 'image/webp', quality))
  if (!blob) throw new Error('이미지 인코딩 실패')
  return blob
}

function uuid(): string {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
}

/* 본인 폴더로 업로드 → {path} 반환 */
async function uploadOwnGoodsImage(userId: string, blob: Blob): Promise<string> {
  const supabase = createClient()
  const path = `${userId}/${uuid()}.webp`
  const { error } = await supabase.storage.from('goods-images').upload(path, blob, { contentType: 'image/webp', upsert: false })
  if (error) throw error
  return path
}

export interface GoodsInput {
  workId: string | null
  goodsTypeId?: string | null
  name?: string | null
  characterName?: string | null
  store?: string | null
  purchasedOn?: string | null   // 'YYYY-MM-DD'
  price?: number | null
  pricePublic?: boolean
  memo?: string | null
  visibility?: GoodsVisibility
  tags?: string[]               // 자유 태그(종류 태그 + 직접 입력). 저장 전 normalizeTags 로 정규화
}

/* 태그 정규화: '#'/공백 제거, 1~30자, 중복 제거, 최대 20개 (DB 제약과 일치) */
export function normalizeTags(input: (string | null | undefined)[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (!raw) continue
    const t = raw.replace(/^#+/, '').trim().replace(/\s+/g, ' ')
    if (!t) continue
    const clipped = t.length > 30 ? t.slice(0, 30) : t
    const key = clipped.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clipped)
    if (out.length >= 20) break
  }
  return out
}

/* 신규 등록: 이미지 업로드 → goods_items insert → goods_item_images insert */
export async function createGoods(input: GoodsInput, files: File[]): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요해요')
  if (!input.workId) throw new Error('작품을 선택해주세요')
  if (!files || files.length === 0) throw new Error('사진을 최소 한 장 올려주세요')

  // 1) 이미지 처리 + 업로드 (실패 시 업로드분 정리)
  const paths: string[] = []
  try {
    for (const f of files) {
      const blob = await processImageToWebp(f)
      paths.push(await uploadOwnGoodsImage(user.id, blob))
    }
  } catch (e) {
    if (paths.length) await supabase.storage.from('goods-images').remove(paths).catch(() => {})
    throw e
  }

  // 2) goods_items insert
  const { data: row, error: insErr } = await supabase.from('goods_items').insert({
    owner_id: user.id,
    work_id: input.workId,
    goods_type_id: input.goodsTypeId ?? null,
    name: input.name?.trim() || null,
    character_name: input.characterName?.trim() || null,
    store: input.store?.trim() || null,
    purchased_on: input.purchasedOn || null,
    price: input.price ?? null,
    price_public: input.pricePublic ?? false,
    memo: input.memo?.trim() || null,
    visibility: input.visibility ?? 'public',
    tags: normalizeTags(input.tags ?? []),
  }).select('id').single()
  if (insErr || !row) {
    await supabase.storage.from('goods-images').remove(paths).catch(() => {})
    throw insErr ?? new Error('굿즈 저장 실패')
  }

  // 3) 이미지 행 insert (실패 시 굿즈 행 + 업로드분 롤백)
  const imgRows = paths.map((p, i) => ({
    goods_item_id: row.id, storage_owner: 'goods', bucket_name: 'goods-images', object_path: p, sort_order: i,
  }))
  const { error: imgErr } = await supabase.from('goods_item_images').insert(imgRows)
  if (imgErr) {
    try { await supabase.from('goods_items').delete().eq('id', row.id) } catch { /* 롤백 실패 무시 */ }
    await supabase.storage.from('goods-images').remove(paths).catch(() => {})
    throw imgErr
  }
  return row.id as string
}

/* ============================================================
   덕질공유(굿즈자랑) 등록 — 커뮤니티 글 + 내 굿즈 동시 생성 (Phase 4)
   - 이미지는 공개 버킷(shop-images)로 EXIF 제거 webp 업로드 → 커뮤니티 글이 소유
   - 굿즈 이미지 행은 클라 직삽 불가(위조 방지). link_community_goods_image RPC 로만 연결
   - board='goods' 커뮤니티 글 + goods_items(공개) + post_goods_links + 이미지 연결
   ============================================================ */
export interface SharedGoodsInput extends GoodsInput {
  postTitle?: string | null
  postContent?: string | null
}

export async function createSharedGoods(input: SharedGoodsInput, files: File[]): Promise<{ goodsId: string; postId: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요해요')
  if (!input.workId) throw new Error('작품을 선택해주세요')
  if (!files || files.length === 0) throw new Error('사진을 최소 한 장 올려주세요')

  // 1) 공개 버킷(shop-images)에 EXIF 제거 webp 업로드
  const uploaded: { path: string; url: string }[] = []
  try {
    for (const f of files) {
      const blob = await processImageToWebp(f)
      const path = `community/${user.id}/${uuid()}.webp`
      const { error } = await supabase.storage.from('shop-images').upload(path, blob, { contentType: 'image/webp', upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
      uploaded.push({ path, url: data.publicUrl })
    }
  } catch (e) {
    if (uploaded.length) await supabase.storage.from('shop-images').remove(uploaded.map(u => u.path)).catch(() => {})
    throw e
  }

  // 2) 커뮤니티 글(board='goods') 생성
  const postId = await createPost(user.id, {
    board: 'goods',
    tagIds: input.workId ? [input.workId] : [],
    title: input.postTitle?.trim() || null,
    content: input.postContent?.trim() || null,
    images: uploaded.map(u => u.url),
    showOnWork: true,
    spoiler: false,
  })
  if (!postId) {
    await supabase.storage.from('shop-images').remove(uploaded.map(u => u.path)).catch(() => {})
    throw new Error('커뮤니티 글 등록에 실패했어요')
  }

  // 3) 내 굿즈(공개) 생성 — 이미지는 아래 RPC 로 연결
  const { data: row, error: insErr } = await supabase.from('goods_items').insert({
    owner_id: user.id,
    work_id: input.workId,
    goods_type_id: input.goodsTypeId ?? null,
    name: input.name?.trim() || null,
    character_name: input.characterName?.trim() || null,
    store: input.store?.trim() || null,
    purchased_on: input.purchasedOn || null,
    price: null, price_public: false,
    memo: input.memo?.trim() || null,
    visibility: 'public',
    tags: normalizeTags(input.tags ?? []),
  }).select('id').single()
  if (insErr || !row) throw insErr ?? new Error('굿즈 저장에 실패했어요')
  const goodsId = row.id as string

  // 4) 글 ↔ 굿즈 링크 (RLS: 본인 글 + 본인 굿즈)
  const { error: linkErr } = await supabase.from('post_goods_links').insert({ post_id: postId, goods_item_id: goodsId })
  if (linkErr) throw linkErr

  // 5) 커뮤니티 이미지 → 굿즈 이미지 연결 (SECURITY DEFINER RPC, 출처 검증)
  for (const u of uploaded) {
    const { error } = await supabase.rpc('link_community_goods_image', {
      p_goods_item_id: goodsId, p_post_id: postId, p_bucket: 'shop-images', p_path: u.path,
    })
    if (error) throw error
  }

  return { goodsId, postId }
}

/* 커뮤니티 굿즈자랑 글(board='goods') → 내 굿즈 자동 등록 연결
   - 커뮤니티 글쓰기 툴에서 이미 shop-images(공개)로 업로드된 이미지 URL 목록을 받아
     goods_items(공개) 생성 + post_goods_links + 이미지 연결(RPC, 출처 검증)
   - 굿즈 이미지 행은 클라 직삽 불가 → link_community_goods_image RPC 로만 */
export async function linkPostToGoods(
  postId: string,
  opts: { workId: string | null; imageUrls: string[]; name?: string | null; characterName?: string | null; goodsTypeId?: string | null; store?: string | null; price?: number | null; tags?: string[] },
): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요해요')

  // 공개 URL → shop-images 오브젝트 경로 (RPC 검증과 동일 규칙: 디코드 안 함, 쿼리스트링 제거)
  const paths: string[] = []
  for (const url of opts.imageUrls) {
    const after = url.split('/shop-images/')[1]
    if (after) paths.push(after.split('?')[0])
  }

  const { data: row, error: insErr } = await supabase.from('goods_items').insert({
    owner_id: user.id,
    work_id: opts.workId,
    goods_type_id: opts.goodsTypeId ?? null,
    name: opts.name?.trim() || null,
    character_name: opts.characterName?.trim() || null,
    store: opts.store?.trim() || null,
    price: opts.price ?? null,
    price_public: false,
    visibility: 'public',
    tags: normalizeTags(opts.tags ?? []),
  }).select('id').single()
  if (insErr || !row) throw insErr ?? new Error('굿즈 저장에 실패했어요')
  const goodsId = row.id as string

  const { error: linkErr } = await supabase.from('post_goods_links').insert({ post_id: postId, goods_item_id: goodsId })
  if (linkErr) throw linkErr

  for (const path of paths) {
    const { error } = await supabase.rpc('link_community_goods_image', {
      p_goods_item_id: goodsId, p_post_id: postId, p_bucket: 'shop-images', p_path: path,
    })
    if (error) throw error
  }
  return goodsId
}

/* 상세 조회(편집 프리필용) */
export async function getGoodsDetail(id: string): Promise<GoodsDetail | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_goods_item', { p_id: id })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  const rawImgs: any[] = Array.isArray(row.images) ? row.images : []
  const covers: RawCover[] = rawImgs.map(im => ({
    imageId: im.id ?? null, storageOwner: im.storage_owner ?? im.storageOwner ?? null,
    bucket: im.bucket ?? null, path: im.path ?? null, external: im.external ?? null,
  }))
  const urls = await resolveCovers(covers)
  const images: GoodsImageDetail[] = rawImgs.map((im, i) => ({
    id: im.id, storageOwner: (im.storage_owner ?? 'goods') as StorageOwner,
    bucket: im.bucket ?? null, path: im.path ?? null, external: im.external ?? null,
    sort: im.sort ?? i, url: urls.get(i) ?? null,
  }))

  return {
    id: row.id, ownerId: row.owner_id,
    workId: row.work_id ?? null, workName: row.work_name ?? null, workSlug: row.work_slug ?? null,
    goodsTypeId: row.goods_type_id ?? null, goodsTypeName: row.goods_type_name ?? null,
    name: row.name ?? null, characterName: row.character_name ?? null,
    store: row.store ?? null, purchasedOn: row.purchased_on ?? null, memo: row.memo ?? null,
    price: row.price ?? null, pricePublic: !!row.price_public,
    visibility: (row.visibility ?? 'public') as GoodsVisibility,
    createdAt: row.created_at, updatedAt: row.updated_at,
    tags: Array.isArray(row.tags) ? row.tags : [],
    images, isFromCommunity: !!row.is_from_community,
  }
}

/* 필드 수정(본인) */
export async function updateGoods(id: string, input: GoodsInput): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, any> = {
    work_id: input.workId ?? null,
    goods_type_id: input.goodsTypeId ?? null,
    name: input.name?.trim() || null,
    character_name: input.characterName?.trim() || null,
    store: input.store?.trim() || null,
    purchased_on: input.purchasedOn || null,
    price: input.price ?? null,
    price_public: input.pricePublic ?? false,
    memo: input.memo?.trim() || null,
    visibility: input.visibility ?? 'public',
    tags: normalizeTags(input.tags ?? []),
  }
  const { error } = await supabase.from('goods_items').update(patch).eq('id', id)
  if (error) throw error
}

/* 편집: 이미지 추가(본인 업로드) — 기존 max sort_order 뒤에 붙임 */
export async function addGoodsImages(goodsItemId: string, files: File[]): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요해요')
  const { data: existing } = await supabase.from('goods_item_images').select('sort_order').eq('goods_item_id', goodsItemId).order('sort_order', { ascending: false }).limit(1)
  let next = (existing && existing[0] ? Number(existing[0].sort_order) + 1 : 0)
  const paths: string[] = []
  try {
    for (const f of files) { const blob = await processImageToWebp(f); paths.push(await uploadOwnGoodsImage(user.id, blob)) }
  } catch (e) {
    if (paths.length) await supabase.storage.from('goods-images').remove(paths).catch(() => {})
    throw e
  }
  const rows = paths.map(p => ({ goods_item_id: goodsItemId, storage_owner: 'goods', bucket_name: 'goods-images', object_path: p, sort_order: next++ }))
  const { error } = await supabase.from('goods_item_images').insert(rows)
  if (error) { await supabase.storage.from('goods-images').remove(paths).catch(() => {}); throw error }
}

/* 편집: 이미지 1장 삭제 (본인 goods 업로드만 Storage에서 제거, community/external은 행만 삭제) */
export async function removeGoodsImage(image: { id: string; storageOwner: StorageOwner; bucket: string | null; path: string | null }): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('goods_item_images').delete().eq('id', image.id)
  if (error) throw error
  if (image.storageOwner === 'goods' && image.bucket === 'goods-images' && image.path) {
    await supabase.storage.from('goods-images').remove([image.path]).catch(() => {})
  }
}

/* 굿즈 삭제 (본인) — 행 삭제(이미지행 cascade) 후 본인 goods 업로드 Storage 정리 */
export async function deleteGoods(id: string): Promise<void> {
  const supabase = createClient()
  const { data: imgs } = await supabase.from('goods_item_images')
    .select('storage_owner, bucket_name, object_path').eq('goods_item_id', id)
  const ownPaths = (imgs ?? [])
    .filter((r: any) => r.storage_owner === 'goods' && r.bucket_name === 'goods-images' && r.object_path)
    .map((r: any) => r.object_path as string)

  const { error } = await supabase.from('goods_items').delete().eq('id', id)
  if (error) throw error
  if (ownPaths.length) await supabase.storage.from('goods-images').remove(ownPaths).catch(() => {})
}
