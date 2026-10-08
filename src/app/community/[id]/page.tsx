import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PostDetailPage from '@/components/community/PostDetailPage'
import { BOARD_LABEL } from '@/types/community-post'
import { pageMeta, toDescription } from '@/lib/seo/pageMeta'

/* 커뮤니티 글 — 화면은 예전처럼 PostDetailPage(브라우저)가 그린다. 여기서는 검색·공유 정보만.
   공개(visibility=public)이고 숨김 처리되지 않은(active) 글만 검색에 싣는다. */
interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: '글을 찾을 수 없어요', robots: { index: false, follow: true } }
  const supabase = await createClient()
  const { data } = await supabase
    .from('community_posts_visible')
    .select('id, board, title, content, images, status, visibility, tags ( name )')
    .eq('id', id)
    .maybeSingle()
  const post = data as any
  if (!post) return { title: '글을 찾을 수 없어요', robots: { index: false, follow: true } }

  const text = toDescription(post.content, 160)
  const title = post.title?.trim() || (text ? text.slice(0, 40) : '커뮤니티 글')
  const board = BOARD_LABEL[post.board] ?? '커뮤니티'
  const firstImg = (post.images?.[0] as string | undefined) ?? (/<img[^>]+src=["']([^"']+)["']/i.exec(post.content ?? '')?.[1] ?? null)
  return pageMeta({
    title: `${title} · ${board}`,
    description: text || `${post.tags?.name ? post.tags.name + ' ' : ''}${board} 글이에요.`,
    path: `/community/${id}`,
    image: firstImg,
    type: 'article',
    noindex: post.status !== 'active' || post.visibility !== 'public',
  })
}

export default function Page() { return <PostDetailPage /> }
