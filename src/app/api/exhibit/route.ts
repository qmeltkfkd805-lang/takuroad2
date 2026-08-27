import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 전시 등록 — 서버에서 세션 검증 → 굿즈 소유·선택 이미지 검증 → 신뢰 스토리지 복사 → create_exhibit.
   저장소 복사·삭제는 service-role, DB INSERT(create_exhibit)는 뷰어 세션(auth.uid) 컨텍스트.
   sharp 미사용 → 신뢰 스토리지(goods-images/shop-images) 원본 형식 그대로 복사(외부 URL 제외). */
const MAX = 8 * 1024 * 1024
const MIME_EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: '잘못된 요청' }, { status: 400 }) }

  const goodsItemId: string = typeof body?.goodsItemId === 'string' ? body.goodsItemId : ''
  const imageIds: string[] = Array.isArray(body?.imageIds) ? body.imageIds.filter((x: any) => typeof x === 'string') : []
  const caption: string | null = typeof body?.caption === 'string' ? body.caption : null
  const visibility: string = typeof body?.visibility === 'string' ? body.visibility : ''
  const sourcePostId: string | null = typeof body?.sourcePostId === 'string' && body.sourcePostId ? body.sourcePostId : null

  if (!goodsItemId) return NextResponse.json({ error: '굿즈를 선택해주세요' }, { status: 400 })
  if (!['public', 'followers', 'private'].includes(visibility)) return NextResponse.json({ error: '공개범위 오류' }, { status: 400 })
  if (imageIds.length < 1 || imageIds.length > 10) return NextResponse.json({ error: '사진은 1~10장' }, { status: 400 })
  if (new Set(imageIds).size !== imageIds.length) return NextResponse.json({ error: '중복 사진' }, { status: 400 })
  if (caption && caption.length > 500) return NextResponse.json({ error: '전시글은 500자 이내' }, { status: 400 })

  const svc = serviceClient()

  // 1) 굿즈 소유 확인
  const { data: goods } = await svc.from('goods_items').select('id, owner_id').eq('id', goodsItemId).maybeSingle()
  if (!goods || (goods as any).owner_id !== user.id) return NextResponse.json({ error: '본인 굿즈가 아닙니다' }, { status: 403 })

  // 2) 선택 이미지 로드 + 그 굿즈 것 + 신뢰 스토리지(외부 제외)
  const { data: imgs } = await svc.from('goods_item_images')
    .select('id, goods_item_id, storage_owner, bucket_name, object_path, external_url')
    .in('id', imageIds).eq('goods_item_id', goodsItemId)
  const byId = new Map((imgs ?? []).map((r: any) => [r.id, r]))
  if (imageIds.some(id => !byId.has(id))) return NextResponse.json({ error: '사진 선택이 올바르지 않습니다' }, { status: 400 })
  for (const id of imageIds) {
    const r: any = byId.get(id)
    if (!r.bucket_name || !r.object_path || !(r.storage_owner === 'goods' || r.storage_owner === 'community')) {
      return NextResponse.json({ error: '외부 이미지는 전시에 넣을 수 없어요. 파일로 다시 올려주세요.' }, { status: 400 })
    }
  }

  // 3) exhibitId 선생성 → 복사 업로드
  const exhibitId = crypto.randomUUID()
  const uploaded: string[] = []
  const images: { path: string; sort: number }[] = []
  try {
    for (let i = 0; i < imageIds.length; i++) {
      const r: any = byId.get(imageIds[i])
      const { data: blob, error: dlErr } = await svc.storage.from(r.bucket_name).download(r.object_path)
      if (dlErr || !blob) throw new Error('원본 이미지를 불러오지 못했어요')
      // content-type 결정: blob.type 우선, 없으면 원본 확장자로 추정
      let type = (blob.type || '').toLowerCase()
      if (!MIME_EXT[type]) {
        const m = String(r.object_path).toLowerCase().match(/\.(webp|jpe?g|png|gif)$/)
        type = m ? (m[1] === 'jpg' || m[1] === 'jpeg' ? 'image/jpeg' : `image/${m[1] === 'jpeg' ? 'jpeg' : m[1]}`) : ''
      }
      const ext = MIME_EXT[type]
      if (!ext) throw new Error('지원하지 않는 이미지 형식이에요 (webp·jpg·png·gif만 가능)')
      const ab = await blob.arrayBuffer()
      if (ab.byteLength < 1 || ab.byteLength > MAX) throw new Error('이미지 크기가 올바르지 않아요')
      const path = `${user.id}/${exhibitId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await svc.storage.from('exhibit-images')
        .upload(path, Buffer.from(ab), { contentType: type, upsert: false })
      if (upErr) throw upErr
      uploaded.push(path)
      images.push({ path, sort: i })
    }

    // 4) DB INSERT — 뷰어 세션(auth.uid) 컨텍스트로 create_exhibit
    const { data: newId, error: rpcErr } = await supabase.rpc('create_exhibit', {
      p_exhibit_id: exhibitId,
      p_goods_item_id: goodsItemId,
      p_source_post_id: sourcePostId,
      p_caption: caption,
      p_visibility: visibility,
      p_images: images,
    })
    if (rpcErr) throw rpcErr
    return NextResponse.json({ id: (newId as string) ?? exhibitId })
  } catch (e: any) {
    if (uploaded.length) await svc.storage.from('exhibit-images').remove(uploaded).catch(() => {})
    return NextResponse.json({ error: e?.message ?? '전시 등록에 실패했어요' }, { status: 400 })
  }
}
