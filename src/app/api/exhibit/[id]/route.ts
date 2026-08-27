import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 전시 상세 — 뷰어 세션으로 get_exhibit_item(권한 필터) → 통과 이미지만 서명(300s) */
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
  if (!row) {
    console.error('[exhibit detail] no row', { id, viewer: user?.id ?? null })
    return NextResponse.json({ error: '전시를 찾을 수 없어요', viewer: user?.id ?? null }, { status: 404 })
  }

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
    ownerId: row.owner_id,
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

/* 전시 삭제 — 소유자만(delete_exhibit RPC). 성공 시 해당 전시의 Storage 객체 즉시 정리(+큐 백업). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const { error } = await supabase.rpc('delete_exhibit', { p_id: id })
  if (error) return NextResponse.json({ error: '권한이 없거나 삭제에 실패했어요' }, { status: 403 })

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
