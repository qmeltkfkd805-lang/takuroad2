import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 전시 관리(소유자 전용) — 편집 화면용.
   GET  : 이미지 id + 서명URL, 캡션/공개범위/원본글/굿즈정보 + 원본 글 후보 목록
   POST : { action: 'update' | 'add' | 'remove' | 'reorder' | 'cover', ... }
   - 쓰기 RPC는 모두 뷰어 세션(auth.uid) 컨텍스트로 호출 → 소유권은 DB 함수가 강제
   - 'add'는 생성과 동일하게 신뢰 스토리지(goods-images/community) 바이트를 exhibit-images로 복사 */

const MAX = 8 * 1024 * 1024
const MIME_EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }

async function ownerGuard(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 }) }
  const svc = serviceClient()
  const { data: ex } = await svc.from('exhibit_items')
    .select('id, owner_id, goods_item_id, caption, visibility, source_post_id, goods_name, work_name')
    .eq('id', id).maybeSingle()
  if (!ex || (ex as any).owner_id !== user.id) return { error: NextResponse.json({ error: '권한이 없습니다' }, { status: 403 }) }
  return { supabase, svc, user, ex: ex as any }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await ownerGuard(id)
  if (g.error) return g.error
  const { svc, ex } = g

  // 이미지(id + 경로) → 서명 URL
  const { data: imgRows } = await svc.from('exhibit_images')
    .select('id, object_path, sort_order').eq('exhibit_id', id).order('sort_order', { ascending: true })
  const rows = imgRows ?? []
  const paths = rows.map((r: any) => r.object_path).filter(Boolean) as string[]
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await svc.storage.from('exhibit-images').createSignedUrls(paths, 300)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }
  const images = rows.map((r: any) => ({ id: r.id, url: urlByPath.get(r.object_path) ?? null })).filter(i => i.url)

  // 원본 글 후보 — 이 굿즈로 쓴 본인 활성 글
  let postOptions: { id: string; title: string | null; createdAt: string }[] = []
  const { data: links } = await svc.from('post_goods_links').select('post_id').eq('goods_item_id', ex.goods_item_id)
  const postIds = (links ?? []).map((l: any) => l.post_id)
  if (postIds.length) {
    const { data: posts } = await svc.from('community_posts')
      .select('id, title, content, created_at, author_id, status, hidden_at')
      .in('id', postIds).eq('author_id', ex.owner_id).eq('status', 'active').is('hidden_at', null)
      .order('created_at', { ascending: false })
    postOptions = (posts ?? []).map((p: any) => ({
      id: p.id,
      title: (p.title && p.title.trim()) ? p.title.trim() : (p.content ? String(p.content).slice(0, 40) : '(제목 없음)'),
      createdAt: p.created_at,
    }))
  }

  return NextResponse.json({
    id: ex.id,
    goodsItemId: ex.goods_item_id,
    goodsName: ex.goods_name ?? null,
    workName: ex.work_name ?? null,
    caption: ex.caption ?? null,
    visibility: ex.visibility,
    sourcePostId: ex.source_post_id ?? null,
    images,
    postOptions,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await ownerGuard(id)
  if (g.error) return g.error
  const { supabase, svc, user, ex } = g

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: '잘못된 요청' }, { status: 400 }) }
  const action: string = typeof body?.action === 'string' ? body.action : ''

  try {
    if (action === 'update') {
      const caption: string | null = typeof body?.caption === 'string' ? body.caption : null
      const visibility: string = typeof body?.visibility === 'string' ? body.visibility : ''
      const sourcePostId: string | null = typeof body?.sourcePostId === 'string' && body.sourcePostId ? body.sourcePostId : null
      if (!['public', 'followers', 'private'].includes(visibility)) return NextResponse.json({ error: '공개범위 오류' }, { status: 400 })
      if (caption && caption.length > 500) return NextResponse.json({ error: '전시글은 500자 이내' }, { status: 400 })
      const { error } = await supabase.rpc('update_exhibit', {
        p_id: id, p_caption: caption, p_visibility: visibility, p_source_post_id: sourcePostId,
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (action === 'remove') {
      const imageId: string = typeof body?.imageId === 'string' ? body.imageId : ''
      if (!imageId) return NextResponse.json({ error: '이미지를 선택해주세요' }, { status: 400 })
      const { error } = await supabase.rpc('remove_exhibit_image', { p_image_id: imageId })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (action === 'reorder') {
      const ordered: string[] = Array.isArray(body?.ordered) ? body.ordered.filter((x: any) => typeof x === 'string') : []
      if (!ordered.length) return NextResponse.json({ error: '순서 정보가 없습니다' }, { status: 400 })
      const { error } = await supabase.rpc('reorder_exhibit_images', { p_id: id, p_ordered: ordered })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (action === 'cover') {
      const imageId: string = typeof body?.imageId === 'string' ? body.imageId : ''
      if (!imageId) return NextResponse.json({ error: '이미지를 선택해주세요' }, { status: 400 })
      const { error } = await supabase.rpc('set_exhibit_cover', { p_image_id: imageId })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    if (action === 'add') {
      const imageIds: string[] = Array.isArray(body?.imageIds) ? body.imageIds.filter((x: any) => typeof x === 'string') : []
      if (imageIds.length < 1 || imageIds.length > 10) return NextResponse.json({ error: '사진은 1~10장' }, { status: 400 })
      if (new Set(imageIds).size !== imageIds.length) return NextResponse.json({ error: '중복 사진' }, { status: 400 })

      // 선택 이미지 = 이 전시의 굿즈 것 + 신뢰 스토리지(외부 제외)
      const { data: imgs } = await svc.from('goods_item_images')
        .select('id, goods_item_id, storage_owner, bucket_name, object_path, external_url')
        .in('id', imageIds).eq('goods_item_id', ex.goods_item_id)
      const byId = new Map((imgs ?? []).map((r: any) => [r.id, r]))
      if (imageIds.some(x => !byId.has(x))) return NextResponse.json({ error: '사진 선택이 올바르지 않습니다' }, { status: 400 })
      for (const x of imageIds) {
        const r: any = byId.get(x)
        if (!r.bucket_name || !r.object_path || !(r.storage_owner === 'goods' || r.storage_owner === 'community')) {
          return NextResponse.json({ error: '외부 이미지는 전시에 넣을 수 없어요. 파일로 다시 올려주세요.' }, { status: 400 })
        }
      }

      const uploaded: string[] = []
      const add: { path: string }[] = []
      try {
        for (const x of imageIds) {
          const r: any = byId.get(x)
          const { data: blob, error: dlErr } = await svc.storage.from(r.bucket_name).download(r.object_path)
          if (dlErr || !blob) throw new Error('원본 이미지를 불러오지 못했어요')
          let type = (blob.type || '').toLowerCase()
          if (!MIME_EXT[type]) {
            const m = String(r.object_path).toLowerCase().match(/\.(webp|jpe?g|png|gif)$/)
            type = m ? (m[1] === 'jpg' || m[1] === 'jpeg' ? 'image/jpeg' : `image/${m[1]}`) : ''
          }
          const ext = MIME_EXT[type]
          if (!ext) throw new Error('지원하지 않는 이미지 형식이에요 (webp·jpg·png·gif만 가능)')
          const ab = await blob.arrayBuffer()
          if (ab.byteLength < 1 || ab.byteLength > MAX) throw new Error('이미지 크기가 올바르지 않아요')
          const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`
          const { error: upErr } = await svc.storage.from('exhibit-images')
            .upload(path, Buffer.from(ab), { contentType: type, upsert: false })
          if (upErr) throw upErr
          uploaded.push(path)
          add.push({ path })
        }
        const { error: rpcErr } = await supabase.rpc('add_exhibit_images', { p_id: id, p_images: add })
        if (rpcErr) throw new Error(rpcErr.message)
        return NextResponse.json({ ok: true })
      } catch (e: any) {
        if (uploaded.length) await svc.storage.from('exhibit-images').remove(uploaded).catch(() => {})
        return NextResponse.json({ error: e?.message ?? '사진 추가에 실패했어요' }, { status: 400 })
      }
    }

    return NextResponse.json({ error: '알 수 없는 작업' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '처리에 실패했어요' }, { status: 400 })
  }
}
