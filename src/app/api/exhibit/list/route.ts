import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 전시 목록 — 뷰어 세션으로 get_exhibit_list(권한 필터) → 통과 cover만 service-role로 서명(600s) */
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get('owner')
  if (!owner) return NextResponse.json({ error: 'owner 필요' }, { status: 400 })

  const supabase = await createClient()
  const { data: rows, error } = await supabase.rpc('get_exhibit_list', { p_owner: owner })
  if (error) return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })

  const list: any[] = rows ?? []
  const paths = list.map(r => r.cover_path).filter(Boolean) as string[]
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const svc = serviceClient()
    const { data: signed } = await svc.storage.from('exhibit-images').createSignedUrls(paths, 600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }

  const items = list.map(r => ({
    id: r.id,
    caption: r.caption ?? null,
    visibility: r.visibility,
    workName: r.work_name ?? null,
    goodsTypeName: r.goods_type_name ?? null,
    coverUrl: r.cover_path ? (urlByPath.get(r.cover_path) ?? null) : null,
    imageCount: Number(r.image_count) || 0,
    hasPost: !!r.has_post,
    createdAt: r.created_at,
  }))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
}
