import { createClient } from '@/lib/supabase/client'
import { getPost, getRepresentativeFanArt } from '@/services/communityPostService'
import type { CommunityPost } from '@/types/community-post'

export type FanartHighlightMode = 'featured' | 'popular' | 'empty'

export interface FanartHighlight {
  mode: FanartHighlightMode
  post: CommunityPost | null
  seasonKey?: string | null
  seasonEnd?: string | null
}

// 작품 홈 대표 팬아트 영역 데이터
//  featured : 이번 시즌 자동 선정 대표 (featured_fanart, status='active')
//  popular  : 대표 선정 전 — 인기 1위 팬아트 임시 노출
//  empty    : 팬아트 자체가 없는 작품
export async function getWorkFanartHighlight(
  tagId: string,
  userId?: string | null,
): Promise<FanartHighlight> {
  const supabase = createClient()

  // 1) 현재 시즌 대표 (가장 최근 active 레코드)
  const { data: feat } = await supabase
    .from('featured_fanart')
    .select('post_id, season_key, season_end')
    .eq('tag_id', tagId)
    .eq('status', 'active')
    .order('season_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (feat && (feat as any).post_id) {
    const post = await getPost((feat as any).post_id, userId)
    // 대표 글이 살아있고 공개 상태일 때만 대표로 취급 (방어적 — 무효화 트리거가 있지만 이중 확인)
    if (post && post.status === 'active' && post.visibility === 'public') {
      return {
        mode: 'featured',
        post,
        seasonKey: (feat as any).season_key ?? null,
        seasonEnd: (feat as any).season_end ?? null,
      }
    }
  }

  // 2) 대표 없음 → 인기 1위 임시 노출
  const pop = await getRepresentativeFanArt(tagId, userId)
  if (pop) return { mode: 'popular', post: pop }

  // 3) 팬아트 없음
  return { mode: 'empty', post: null }
}

// 작품 팬아트 게시글별 대표 배지 상태
//  current : 이번 시즌(가장 최근) 대표
//  past    : 과거 시즌 대표 이력
export async function getFanartBadgesForTag(tagId: string): Promise<Map<string, 'current' | 'past'>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('featured_fanart')
    .select('post_id, season_start')
    .eq('tag_id', tagId)
    .eq('status', 'active')
    .order('season_start', { ascending: false })

  const map = new Map<string, 'current' | 'past'>()
  if (!data || !data.length) return map
  const latest = (data[0] as any).season_start
  for (const r of data as any[]) {
    if (r.season_start === latest) map.set(r.post_id, 'current')
    else if (!map.has(r.post_id)) map.set(r.post_id, 'past')
  }
  return map
}

// 작가 명예 — 대표 팬아트 선정 횟수 + 선정된 작품들
export interface UserFanartHonor {
  count: number   // 총 선정 횟수(시즌 수)
  works: { tagId: string; name: string; slug: string | null; seasons: number }[]
}
export async function getUserFanartHonor(userId: string): Promise<UserFanartHonor> {
  const supabase = createClient()
  const { data } = await supabase
    .from('featured_fanart')
    .select('tag_id, tags ( id, name, slug )')
    .eq('author_id', userId)
    .eq('status', 'active')

  if (!data || !data.length) return { count: 0, works: [] }
  const map = new Map<string, { tagId: string; name: string; slug: string | null; seasons: number }>()
  for (const r of data as any[]) {
    const t = Array.isArray(r.tags) ? r.tags[0] : r.tags
    if (!t) continue
    const cur = map.get(t.id) ?? { tagId: t.id, name: t.name, slug: t.slug ?? null, seasons: 0 }
    cur.seasons++
    map.set(t.id, cur)
  }
  return { count: data.length, works: Array.from(map.values()).sort((a, b) => b.seasons - a.seasons) }
}

// 명예의 전당 — 작품 무관, 역대 점수 높은 순 플랫 랭킹
export interface HallItem {
  tagId: string
  workName: string
  workSlug: string | null
  postId: string
  image: string | null
  title: string | null
  author: { id: string; nickname: string | null } | null
  seasonKey: string | null
  seasonStart: string
  isCurrent: boolean
  score: number
}
export async function getHallOfFame(): Promise<HallItem[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('featured_fanart')
    .select('tag_id, post_id, season_key, season_start, score_snapshot, tags ( id, name, slug ), profiles ( id, nickname )')
    .eq('status', 'active')
    .order('season_start', { ascending: false })

  if (!data || !data.length) return []

  // 게시글 이미지/제목은 post_id로 별도 조회 (FK 없음)
  const postIds = Array.from(new Set((data as any[]).map(r => r.post_id)))
  const { data: posts } = await supabase
    .from('community_posts')
    .select('id, title, images')
    .in('id', postIds)
  const pmap = new Map<string, any>((posts ?? []).map((p: any) => [p.id, p]))

  // 작품별 최신 시즌 (data는 season_start desc 정렬) → 현재 대표 표시용
  const latestByTag = new Map<string, string>()
  for (const r of data as any[]) if (!latestByTag.has(r.tag_id)) latestByTag.set(r.tag_id, r.season_start)

  const items: HallItem[] = (data as any[]).map(r => {
    const t = Array.isArray(r.tags) ? r.tags[0] : r.tags
    const a = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    const p = pmap.get(r.post_id)
    return {
      tagId: r.tag_id,
      workName: t?.name ?? '작품',
      workSlug: t?.slug ?? null,
      postId: r.post_id,
      image: p?.images?.[0] ?? null,
      title: p?.title ?? null,
      author: a ? { id: a.id, nickname: a.nickname } : null,
      seasonKey: r.season_key ?? null,
      seasonStart: r.season_start,
      isCurrent: r.season_start === latestByTag.get(r.tag_id),
      score: Number((r.score_snapshot as any)?.total ?? 0),
    }
  })

  // 역대 점수 높은 순 (동점이면 최근 시즌 먼저)
  items.sort((a, b) => b.score - a.score || (a.seasonStart < b.seasonStart ? 1 : -1))
  return items
}
