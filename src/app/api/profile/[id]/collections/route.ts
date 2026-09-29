import { NextResponse } from 'next/server'
import { resolveProfileAccess, resolveGoodsImageUrls, noStore } from '@/lib/profile/profileAccess'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 공개 프로필 > 전시관 > 작품별 전시 = 굿즈 보관함의 "작품별 컬렉션"
   GET /api/profile/{userId}/collections
   1) 공개범위 '굿즈'와 '컬렉션'을 둘 다 통과해야 한다 (하나라도 막히면 hidden)
   2) 목록은 보는 사람 세션으로 get_goods_collections → 굿즈별 공개범위(can_view_goods)로 다시 거른 개수·사진
   3) 대표 사진: 주인이 고른 대표 굿즈(goods_collection_covers)가 보는 사람에게 보일 때만 → 아니면 최근 굿즈 → 작품 이미지 */

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acc = await resolveProfileAccess({ id })
  if (!acc) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore })
  if (!acc.allow('goods') || !acc.allow('collections')) return NextResponse.json({ items: [], hidden: true }, { headers: noStore })

  const { data, error } = await acc.viewer.rpc('get_goods_collections', { p_owner: acc.owner.id })
  if (error) return NextResponse.json({ error: 'load_failed' }, { status: 500, headers: noStore })
  const rows = (data ?? []) as any[]

  // 최근 굿즈 사진(각 컬렉션 첫 장)
  const recent = rows.map(r => (Array.isArray(r.recent_covers) ? r.recent_covers.find((c: any) => c && (c.path || c.external)) : null) ?? null)
  const recentUrls = await resolveGoodsImageUrls(acc.svc, recent.map(c => ({
    storageOwner: c?.storage_owner ?? null, bucket: c?.bucket ?? null, path: c?.path ?? null, external: c?.external ?? null,
  })))

  // 주인이 고른 대표 굿즈 — 보는 사람이 그 굿즈를 볼 수 있을 때만 쓴다
  const chosenUrl = new Map<string, string>()
  const { data: covers, error: cErr } = await acc.svc.from('goods_collection_covers')
    .select('work_id, cover_item_id').eq('owner_id', acc.owner.id)
  if (!cErr && covers?.length) {
    const workIds = new Set(rows.map(r => r.work_id).filter(Boolean))
    await Promise.all((covers as any[]).filter(c => workIds.has(c.work_id)).map(async c => {
      const { data: it } = await acc.viewer.rpc('get_goods_item', { p_id: c.cover_item_id })
      const row = Array.isArray(it) ? it[0] : it
      const img = Array.isArray(row?.images) ? row.images[0] : null
      if (!row || !img || row.work_id !== c.work_id) return
      const [u] = await resolveGoodsImageUrls(acc.svc, [{ storageOwner: img.storage_owner ?? null, bucket: img.bucket ?? null, path: img.path ?? null, external: img.external ?? null }])
      if (u) chosenUrl.set(c.work_id, u)
    }))
  }

  const items = rows.map((r, i) => ({
    workId: r.work_id ?? null,
    workName: r.work_name ?? null,
    workSlug: r.work_slug ?? null,
    count: Number(r.item_count) || 0,
    coverUrl: (r.work_id && chosenUrl.get(r.work_id)) || recentUrls[i] || r.cover_url || null,
  })).sort((a, b) => (a.workId ? 0 : 1) - (b.workId ? 0 : 1) || b.count - a.count)

  return NextResponse.json({ items, hidden: false }, { headers: noStore })
}
