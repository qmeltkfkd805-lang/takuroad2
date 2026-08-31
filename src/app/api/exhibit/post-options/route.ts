import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 원본 글 후보 목록 — 전시 "등록" 화면용(편집은 /api/exhibit/[id]/manage GET에 포함).
   GET /api/exhibit/post-options?goodsId=<uuid>
   이 굿즈로 쓴 "본인" 활성 자랑 글만. 소유 검증은 service-role 조회 + 세션 uid 비교. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const goodsItemId = new URL(req.url).searchParams.get('goodsId') ?? ''
  if (!UUID_RE.test(goodsItemId)) return NextResponse.json({ error: '굿즈를 선택해주세요' }, { status: 400 })

  const svc = serviceClient()

  // 굿즈 소유 확인
  const { data: goods } = await svc.from('goods_items').select('id, owner_id').eq('id', goodsItemId).maybeSingle()
  if (!goods || (goods as any).owner_id !== user.id) return NextResponse.json({ error: '본인 굿즈가 아닙니다' }, { status: 403 })

  // 이 굿즈에 연결된 글 중 본인 활성 글만
  let postOptions: { id: string; title: string; createdAt: string }[] = []
  const { data: links } = await svc.from('post_goods_links').select('post_id').eq('goods_item_id', goodsItemId)
  const postIds = (links ?? []).map((l: any) => l.post_id).filter(Boolean)
  if (postIds.length) {
    const { data: posts } = await svc.from('community_posts')
      .select('id, title, content, created_at, author_id, status, hidden_at')
      .in('id', postIds).eq('author_id', user.id).eq('status', 'active').is('hidden_at', null)
      .order('created_at', { ascending: false })
    postOptions = (posts ?? []).map((p: any) => ({
      id: p.id,
      title: (p.title && p.title.trim()) ? p.title.trim() : (p.content ? String(p.content).slice(0, 40) : '(제목 없음)'),
      createdAt: p.created_at,
    }))
  }

  return NextResponse.json({ postOptions }, { headers: { 'Cache-Control': 'private, no-store' } })
}
