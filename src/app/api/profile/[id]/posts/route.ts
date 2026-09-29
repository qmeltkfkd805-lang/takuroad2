import { NextResponse } from 'next/server'
import { resolveProfileAccess, isHttp, noStore } from '@/lib/profile/profileAccess'
import { htmlToPlainText } from '@/lib/text/htmlToPlainText'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 공개 프로필 > 게시글
   GET /api/profile/{userId}/posts?before=ISO
   - 보는 사람 세션으로 읽는다 → community_posts RLS(cposts_select)가 그대로 적용
   - 거기에 더해 명시적으로: 활성 글만, 남이 보면 공개 글만 (본인은 나만 보기 글도)
   - 숨김(신고) 글은 본인에게도 여기선 안 보인다(마이페이지 > 작성한 글에서 확인·이의제기) */

const PAGE = 24

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acc = await resolveProfileAccess({ id })
  if (!acc) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStore })

  const before = new URL(req.url).searchParams.get('before')
  let q = acc.viewer.from('community_posts')
    .select('id, board, title, content, images, visibility, like_count, comment_count, created_at, tags ( name )')
    .eq('author_id', acc.owner.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(PAGE + 1)
  if (!acc.isSelf) q = q.eq('visibility', 'public')
  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: 'load_failed' }, { status: 500, headers: noStore })

  const rows = (data ?? []) as any[]
  const items = rows.slice(0, PAGE).map(r => {
    const imgs = (Array.isArray(r.images) ? r.images : []).filter(isHttp)
    const text = htmlToPlainText(r.content)
    return {
      id: r.id,
      board: r.board,
      title: (r.title && String(r.title).trim()) || null,
      excerpt: text ? text.replace(/\s+/g, ' ').slice(0, 90) : null,
      thumb: imgs[0] ?? null,
      imageCount: imgs.length,
      workName: r.tags?.name ?? null,
      isPrivate: acc.isSelf && r.visibility === 'private',
      likeCount: r.like_count ?? 0,
      commentCount: r.comment_count ?? 0,
      createdAt: r.created_at,
    }
  })
  return NextResponse.json(
    { items, nextBefore: rows.length > PAGE ? items[items.length - 1].createdAt : null },
    { headers: noStore },
  )
}
