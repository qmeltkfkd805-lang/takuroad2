import { createClient } from '@/lib/supabase/client'

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
export async function getMyGoodsCollections(): Promise<GoodsCollection[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase.rpc('get_goods_collections', { p_owner: user.id })
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

/* ── 프로필 굿즈 카운트(굿즈 수·컬렉션 수) ── */
export async function getMyGoodsCounts(): Promise<{ goodsCount: number; collectionCount: number }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { goodsCount: 0, collectionCount: 0 }
  const { data, error } = await supabase.rpc('get_goods_counts', { p_owner: user.id })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { goodsCount: Number(row?.goods_count) || 0, collectionCount: Number(row?.collection_count) || 0 }
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
