import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { htmlToPlainText } from '@/lib/text/htmlToPlainText'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const isHttp = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//.test(v)

/* 전시 상세 — 뷰어 세션 기준 권한 필터.
   1) legacy: get_exhibit_item → 통과 이미지만 서명(300s)
   2) 없으면 post: get_exhibit_entry(can_view_post) → 원본 글의 공개 URL·본문 그대로 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rows, error: rpcErr } = await supabase.rpc('get_exhibit_item', { p_id: id })
  if (rpcErr) {
    console.error('[exhibit detail] rpc error:', rpcErr.message)
    return NextResponse.json({ error: 'RPC 오류: ' + rpcErr.message }, { status: 500 })
  }
  const row: any = Array.isArray(rows) ? rows[0] : rows

  if (row) {
    const rawImgs: any[] = Array.isArray(row.images) ? row.images : []
    const paths = rawImgs.map(im => im.path).filter(Boolean) as string[]
    const urlByPath = new Map<string, string>()
    if (paths.length) {
      const svc = serviceClient()
      const { data: signed } = await svc.storage.from('exhibit-images').createSignedUrls(paths, 300)
      for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
    }

    return NextResponse.json({
      id: row.id,
      kind: 'legacy',
      ownerId: row.owner_id,
      title: null,
      caption: row.caption ?? null,
      visibility: row.visibility,
      goodsName: row.goods_name ?? null,
      goodsTypeName: row.goods_type_name ?? null,
      workId: row.work_id ?? null,
      workName: row.work_name ?? null,
      images: paths.map(p => urlByPath.get(p) ?? null).filter(Boolean),
      postId: row.post_id ?? null,
      goodsItemId: row.goods_item_id ?? null,
      createdAt: row.created_at,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  // 새 방식(원본 글 연결) 전시
  const { data: eRows, error: eErr } = await supabase.rpc('get_exhibit_entry', { p_id: id })
  if (eErr) console.error('[exhibit detail] entry rpc error:', eErr.message)
  const e: any = !eErr ? (Array.isArray(eRows) ? eRows[0] : eRows) : null
  if (!e) {
    console.error('[exhibit detail] no row', { id, viewer: user?.id ?? null })
    return NextResponse.json({ error: '전시를 찾을 수 없어요', viewer: user?.id ?? null }, { status: 404 })
  }

  return NextResponse.json({
    id: e.id,
    kind: 'post',
    ownerId: e.owner_id,
    title: e.title ?? null,
    caption: htmlToPlainText(e.content),   // 본문은 HTML로 저장돼 있다 → 글자만
    visibility: e.visibility === 'private' ? 'private' : 'public',
    goodsName: null,
    goodsTypeName: e.goods_type_name ?? null,
    workId: e.work_id ?? null,
    workName: e.work_name ?? null,
    images: (Array.isArray(e.images) ? e.images : []).filter(isHttp),
    postId: e.post_id ?? null,
    goodsItemId: null,
    createdAt: e.created_at,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/* 전시에서 빼기 — 소유자만.
   ?kind=post   : remove_exhibit_entry — 연결만 해제. 원본 글·사진은 그대로.
   그 외(legacy): delete_exhibit — 전시와 전시용 사진 삭제. 성공 시 Storage 객체 즉시 정리(+트리거 큐 백업).
                  내 굿즈(goods_items)와 굿즈 사진은 건드리지 않는다. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const kind = new URL(req.url).searchParams.get('kind')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  if (kind === 'post') {
    const { error } = await supabase.rpc('remove_exhibit_entry', { p_id: id })
    if (error) return NextResponse.json({ error: '권한이 없거나 전시에서 빼지 못했어요' }, { status: 403 })
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase.rpc('delete_exhibit', { p_id: id })
  if (error) return NextResponse.json({ error: '권한이 없거나 전시에서 빼지 못했어요' }, { status: 403 })

  // 즉시 Storage 정리(prefix = {uid}/{id}). 실패해도 트리거가 큐에 적재해 둠.
  try {
    const svc = serviceClient()
    const prefix = `${user.id}/${id}`
    const { data: files } = await svc.storage.from('exhibit-images').list(prefix)
    const paths = (files ?? []).map(f => `${prefix}/${f.name}`)
    if (paths.length) await svc.storage.from('exhibit-images').remove(paths)
  } catch { /* 큐가 백업 */ }

  return NextResponse.json({ ok: true })
}
