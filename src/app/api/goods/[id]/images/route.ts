import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { resolveGoodsImageUrls, noStore } from '@/lib/profile/profileAccess'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 굿즈 상세의 사진 URL — 남의 굿즈를 볼 때 쓴다.
   GET /api/goods/{goodsId}/images
   goods-images 버킷은 주인 폴더만 서명할 수 있어서, 다른 사람은 브라우저에서 사진을 못 연다.
   보는 사람 세션으로 get_goods_item(can_view_goods)을 통과한 굿즈의 사진만 service-role 로 서명한다. */

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await createClient()
  const { data, error } = await viewer.rpc('get_goods_item', { p_id: id })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore })

  const imgs: any[] = Array.isArray((row as any).images) ? (row as any).images : []
  const urls = await resolveGoodsImageUrls(serviceClient(), imgs.map(im => ({
    storageOwner: im.storage_owner ?? null, bucket: im.bucket ?? null, path: im.path ?? null, external: im.external ?? null,
  })))
  return NextResponse.json({ images: imgs.map((im, i) => ({ id: im.id, url: urls[i] })) }, { headers: noStore })
}
