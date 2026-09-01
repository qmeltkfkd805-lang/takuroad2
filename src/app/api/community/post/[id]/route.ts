import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 글 삭제 + 연결된 굿즈 동반 삭제 (작성자 본인만)
   DELETE /api/community/post/{id}

   굿즈 자랑 글을 지우면 내 굿즈에서도 사라진다. 단, 아래 중 하나라도 걸리면 굿즈는 남긴다:
   - 그 굿즈로 쓴 다른 자랑 글이 아직 있음
   - 그 굿즈가 전시관에 걸려 있음(exhibit_items가 참조 중 — 지우면 전시가 깨진다)
   - 굿즈 주인이 글쓴이가 아님(있을 수 없지만 방어)
   응답의 keptGoods로 호출부가 "굿즈는 남겨뒀어요"를 안내한다.

   ⚠️ shop-images(community 출처) 이미지는 건드리지 않는다 — 다른 글 본문이 같은 URL을 쓸 수 있음. */

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const svc = serviceClient()

  // 1) 글 확인 — 작성자 본인만
  const { data: post } = await svc.from('community_posts').select('id, author_id').eq('id', id).maybeSingle()
  if (!post) return NextResponse.json({ error: '글을 찾을 수 없어요' }, { status: 404 })
  if ((post as any).author_id !== user.id) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  // 2) 이 글에 연결된 굿즈
  const { data: links } = await svc.from('post_goods_links').select('goods_item_id').eq('post_id', id)
  const goodsIds = [...new Set((links ?? []).map((l: any) => l.goods_item_id).filter(Boolean))] as string[]

  // 3) 굿즈별로 같이 지울지 판단 (글 삭제 전에 해야 다른 연결을 정확히 셀 수 있다)
  const toDelete: string[] = []
  const kept: { id: string; reason: 'other_post' | 'exhibit' | 'not_owner' }[] = []
  for (const gid of goodsIds) {
    const { data: g } = await svc.from('goods_items').select('id, owner_id').eq('id', gid).maybeSingle()
    if (!g || (g as any).owner_id !== user.id) { kept.push({ id: gid, reason: 'not_owner' }); continue }

    const { data: others } = await svc.from('post_goods_links')
      .select('post_id').eq('goods_item_id', gid).neq('post_id', id).limit(1)
    if ((others ?? []).length) { kept.push({ id: gid, reason: 'other_post' }); continue }

    const { data: exs } = await svc.from('exhibit_items').select('id').eq('goods_item_id', gid).limit(1)
    if ((exs ?? []).length) { kept.push({ id: gid, reason: 'exhibit' }); continue }

    toDelete.push(gid)
  }

  // 4) 글 삭제 (뷰어 세션 컨텍스트 — RLS가 소유권을 한 번 더 강제)
  const { error: postErr } = await supabase.from('community_posts').delete().eq('id', id)
  if (postErr) return NextResponse.json({ error: '글 삭제에 실패했어요' }, { status: 400 })

  // 5) 굿즈 삭제 + 본인이 올린 goods-images 정리. 실패해도 글 삭제는 이미 끝났으므로 계속 진행.
  const deleted: string[] = []
  for (const gid of toDelete) {
    try {
      const { data: imgs } = await svc.from('goods_item_images')
        .select('storage_owner, bucket_name, object_path').eq('goods_item_id', gid)
      const paths = (imgs ?? [])
        .filter((r: any) => r.storage_owner === 'goods' && r.bucket_name === 'goods-images' && r.object_path)
        .map((r: any) => r.object_path as string)

      const { error: delErr } = await svc.from('goods_items').delete().eq('id', gid)
      if (delErr) throw new Error(delErr.message)
      deleted.push(gid)
      if (paths.length) await svc.storage.from('goods-images').remove(paths)
    } catch (e: any) {
      console.error('[post delete] 굿즈 삭제 실패', gid, e?.message ?? e)
      kept.push({ id: gid, reason: 'other_post' })
    }
  }

  return NextResponse.json({ ok: true, deletedGoods: deleted, keptGoods: kept })
}
