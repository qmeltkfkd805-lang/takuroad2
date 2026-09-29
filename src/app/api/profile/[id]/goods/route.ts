import { NextResponse } from 'next/server'
import { resolveProfileAccess, resolveGoodsImageUrls, noStore } from '@/lib/profile/profileAccess'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 공개 프로필 > 전시관 > 내 굿즈
   GET /api/profile/{userId}/goods?before=ISO
   1) 프로필 공개범위 '굿즈'(privacy_settings.goods)를 먼저 본다 — 막혀 있으면 빈 목록 + hidden
   2) 목록은 보는 사람 세션으로 get_goods_list RPC → can_view_goods(굿즈별 공개범위)가 다시 거른다
   3) 통과한 행의 사진만 service-role 로 서명(10분). 구입처·구매일·메모·비공개 가격은 싣지 않는다
   4) 굿즈자랑 글에서 온 굿즈는 "보는 사람이 볼 수 있는" 원본 글 id 만 붙인다(RLS 로 확인) */

const PAGE = 30

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acc = await resolveProfileAccess({ id })
  if (!acc) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore })
  if (!acc.allow('goods')) return NextResponse.json({ items: [], nextBefore: null, hidden: true }, { headers: noStore })

  const sp = new URL(req.url).searchParams
  const before = sp.get('before')
  // ?work=<작품 id> 는 그 작품 컬렉션만, ?work=none 은 작품 미지정만 (작품별 전시에서 씀)
  const work = sp.get('work')
  const workId = work && /^[0-9a-f-]{36}$/i.test(work) ? work : null
  const { data, error } = await acc.viewer.rpc('get_goods_list', {
    p_owner: acc.owner.id, p_limit: PAGE + 1, p_before: before || null, p_order: 'recent',
    p_work: workId, p_only_unassigned: work === 'none',
  })
  if (error) return NextResponse.json({ error: 'load_failed' }, { status: 500, headers: noStore })

  const rows = ((data ?? []) as any[]).filter(r => r.owner_id === acc.owner.id)
  const page = rows.slice(0, PAGE)

  const urls = await resolveGoodsImageUrls(acc.svc, page.map(r => ({
    storageOwner: r.cover_storage_owner ?? null, bucket: r.cover_bucket ?? null,
    path: r.cover_path ?? null, external: r.cover_external ?? null,
  })))

  // 굿즈 → 원본 글 (보는 사람이 볼 수 있는 글만)
  const postByGoods = new Map<string, string>()
  const fromPost = page.filter(r => r.is_from_community).map(r => r.id)
  if (fromPost.length) {
    const { data: links } = await acc.svc.from('post_goods_links')
      .select('goods_item_id, post_id, created_at').in('goods_item_id', fromPost).order('created_at', { ascending: true })
    const postIds = [...new Set((links ?? []).map((l: any) => l.post_id))]
    if (postIds.length) {
      let pq = acc.viewer.from('community_posts').select('id').in('id', postIds).eq('status', 'active')
      if (!acc.isSelf) pq = pq.eq('visibility', 'public')
      const { data: visible } = await pq
      const ok = new Set((visible ?? []).map((p: any) => p.id))
      for (const l of (links ?? []) as any[]) {
        if (ok.has(l.post_id) && !postByGoods.has(l.goods_item_id)) postByGoods.set(l.goods_item_id, l.post_id)
      }
    }
  }

  const items = page.map((r, i) => ({
    id: r.id,
    name: r.name ?? null,
    goodsTypeName: r.goods_type_name ?? null,
    workName: r.work_name ?? null,
    coverUrl: urls[i] ?? r.work_cover_url ?? null,
    coverIsWork: !urls[i] && !!r.work_cover_url,
    postId: postByGoods.get(r.id) ?? null,
    createdAt: r.created_at,
  }))
  return NextResponse.json(
    { items, nextBefore: rows.length > PAGE ? page[page.length - 1].created_at : null, hidden: false },
    { headers: noStore },
  )
}
