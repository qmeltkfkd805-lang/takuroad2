import { cache } from 'react'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { resolveProfileAccess } from '@/lib/profile/profileAccess'
import PublicProfilePage, { type PublicProfileData, type ProfileTab } from '@/components/profile/public/PublicProfilePage'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ nickname: string }>
  searchParams: Promise<{ tab?: string; sub?: string }>
}

/* 공개 프로필 /user/[nickname]
   누가 볼 수 있는지는 lib/profile/profileAccess 한 곳에서 정한다.
   (없는 사용자 · 차단 관계 · 비공개 프로필 → 모두 같은 404) */

const load = cache(async (nickname: string): Promise<PublicProfileData | null> => {
  const acc = await resolveProfileAccess({ nickname })
  if (!acc) return null
  const { owner, svc, viewer } = acc

  // 게시글 수 — 보는 사람 세션(RLS) + 활성·공개 글만 (본인은 나만 보기 글 포함)
  let pc = viewer.from('community_posts').select('id', { count: 'exact', head: true })
    .eq('author_id', owner.id).eq('status', 'active')
  if (!acc.isSelf) pc = pc.eq('visibility', 'public')

  const [posts, followers, following] = await Promise.all([
    pc,
    svc.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', owner.id),
    svc.from('user_follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', owner.id),
  ])

  // 좋아하는 작품 — 대표 작품(프로필에 직접 고른 것) + 최애 작품(공개범위 '관심 작품' 통과 시)
  const workIds: string[] = []
  if (owner.featuredWorkId) workIds.push(owner.featuredWorkId)
  if (acc.allow('liked_works')) {
    const { data: favs } = await svc.from('user_favorite_tags').select('tag_id')
      .eq('user_id', owner.id).eq('tier', 'favorite').limit(8)
    for (const f of (favs ?? []) as any[]) if (f.tag_id && !workIds.includes(f.tag_id)) workIds.push(f.tag_id)
  }
  let works: PublicProfileData['works'] = []
  if (workIds.length) {
    const { data: tags } = await viewer.from('tags').select('id, name, slug').in('id', workIds.slice(0, 6))
    const byId = new Map(((tags ?? []) as any[]).map(t => [t.id, t]))
    works = workIds.map(id => byId.get(id)).filter(Boolean).map((t: any) => ({ id: t.id, name: t.name, slug: t.slug ?? null }))
  }

  return {
    user: { id: owner.id, nickname: owner.nickname, avatarUrl: owner.avatarUrl, bio: owner.bio },
    works,
    stats: { posts: posts.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 },
    isSelf: acc.isSelf,
    initialFollowing: acc.isFollower,
    can: { goods: acc.allow('goods'), collections: acc.allow('collections'), visits: acc.allow('activity') },
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nickname } = await params
  const data = await load(decodeURIComponent(nickname))
  if (!data) return { title: '프로필을 찾을 수 없어요' }
  return {
    title: `${data.user.nickname}님의 프로필`,
    description: data.user.bio ?? `${data.user.nickname}님의 전시관과 방문 기록`,
  }
}

export default async function UserPage({ params, searchParams }: Props) {
  const { nickname } = await params
  const sp = await searchParams
  const data = await load(decodeURIComponent(nickname))
  if (!data) notFound()

  const tab: ProfileTab = sp.tab === 'posts' || sp.tab === 'visits' ? sp.tab : 'exhibit'
  const sub = sp.sub === 'goods' || sp.sub === 'works' ? sp.sub : 'exhibit'
  return <PublicProfilePage data={data} initialTab={tab} initialSub={sub} />
}
