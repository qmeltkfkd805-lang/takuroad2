import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { htmlToPlainText } from '@/lib/text/htmlToPlainText'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 전시 목록 — 두 종류를 합쳐 최신순으로 돌려준다.
   - legacy(exhibit_items) : 뷰어 세션 get_exhibit_list(권한 필터) → 통과 cover만 service-role로 서명(600s)
   - post(exhibit_entries) : 뷰어 세션 get_exhibit_entry_list(can_view_post 필터) → 원본 글의 공개 URL 그대로
   새 방식 RPC가 아직 없거나 실패해도 기존 전시는 그대로 보이게 한다. */

const isHttp = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//.test(v)

export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get('owner')
  if (!owner) return NextResponse.json({ error: 'owner 필요' }, { status: 400 })

  const supabase = await createClient()
  const [legacyRes, entryRes] = await Promise.all([
    supabase.rpc('get_exhibit_list', { p_owner: owner }),
    supabase.rpc('get_exhibit_entry_list', { p_owner: owner }),
  ])
  if (legacyRes.error) return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })
  if (entryRes.error) console.error('[exhibit list] entry rpc error:', entryRes.error.message)

  const list: any[] = legacyRes.data ?? []
  const paths = list.map(r => r.cover_path).filter(Boolean) as string[]
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const svc = serviceClient()
    const { data: signed } = await svc.storage.from('exhibit-images').createSignedUrls(paths, 600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }

  const legacy = list.map(r => ({
    id: r.id,
    kind: 'legacy' as const,
    postId: null,
    caption: r.caption ?? null,
    visibility: r.visibility,
    workName: r.work_name ?? null,
    goodsTypeName: r.goods_type_name ?? null,
    coverUrl: r.cover_path ? (urlByPath.get(r.cover_path) ?? null) : null,
    imageCount: Number(r.image_count) || 0,
    hasPost: !!r.has_post,
    createdAt: r.created_at,
  }))

  const entries = ((entryRes.error ? [] : entryRes.data) ?? []).map((r: any) => {
    const imgs = (Array.isArray(r.images) ? r.images : []).filter(isHttp)
    const text = (r.title && String(r.title).trim()) || (htmlToPlainText(r.content)?.slice(0, 80) ?? null)
    return {
      id: r.id,
      kind: 'post' as const,
      postId: r.post_id,
      caption: text,
      visibility: r.visibility === 'private' ? 'private' : 'public',
      workName: r.work_name ?? null,
      goodsTypeName: r.goods_type_name ?? null,
      coverUrl: imgs[0] ?? null,
      imageCount: imgs.length,
      hasPost: true,
      createdAt: r.created_at,
    }
  })

  const items = [...legacy, ...entries].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
}
