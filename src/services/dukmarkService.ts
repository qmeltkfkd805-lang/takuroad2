import { createClient } from '@/lib/supabase/client'
import { getVisiblePostsByIds } from '@/services/communityPostService'
import { mergeSiteUrls, cleanSiteUrl } from '@/lib/utils/dukmark'
import {
  DukmarkCard, DukmarkInput, DukmarkUse, PostDukmark,
  DUKMARK_USES, DUKMARK_MAX_USES, DUKMARK_SUMMARY_MAX, DUKMARK_MAX_SOURCES, DUKMARK_MAX_MAKER_LINKS,
} from '@/types/community-post'

/* 덕마크 — 덕질 노하우 글에 붙는 북마크 표시 (글 하나에 하나).
   DB: migrations/post_dukmarks.sql (post_dukmarks 표)
   - 켜기·고치기·끄기는 그 글 작성자만, 덕질 노하우 글만 (RLS)
   - 저장 수는 saved_posts 에 넣고 뺄 때 DB 트리거가 맞춘다
   - 홈 추천은 관리자 RPC(set_dukmark_featured)로만 */

const COLS = 'post_id, uses, cover_url, summary, site_urls, sites, sources, by_maker, save_count, featured_at'
const USE_SET = new Set<string>(DUKMARK_USES.map(u => u.value))

function toDukmark(r: any): PostDukmark {
  return {
    postId: String(r.post_id),
    uses: ((r.uses ?? []) as string[]).filter(u => USE_SET.has(u)) as DukmarkUse[],
    coverUrl: r.cover_url ?? null,
    summary: r.summary ?? null,
    siteUrls: r.site_urls ?? [],
    sites: ((r.sites ?? []) as any[]).map(s => ({ url: String(s.url), name: s.name ?? null, desc: s.desc ?? null, maker: s.maker ?? null, makerLinks: Array.isArray(s.maker_links) ? s.maker_links : [] })),
    sources: ((r.sources ?? []) as any[]).map(s => ({ label: String(s.label), url: s.url ?? null })),
    byMaker: r.by_maker === true,
    saveCount: r.save_count ?? 0,
    featuredAt: r.featured_at ?? null,
  }
}

/** 덕마크 행들 → 지금 보이는 글과 짝지은 카드 (행 순서 유지, 안 보이는 글은 뺀다) */
async function withPosts(rows: any[], userId?: string | null): Promise<DukmarkCard[]> {
  const marks = rows.map(toDukmark)
  const posts = await getVisiblePostsByIds(marks.map(m => m.postId), userId)
  const byId = new Map(posts.map(p => [String(p.id), p]))
  return marks.flatMap(dukmark => {
    const post = byId.get(dukmark.postId)
    return post ? [{ post, dukmark }] : []
  })
}

/** 글의 덕마크 (없으면 null) — 글 상세 배지, 글쓰기 수정 화면 */
export async function getPostDukmark(postId: string): Promise<PostDukmark | null> {
  const supabase: any = createClient()   // 새 표라 타입 정의에 아직 없음
  const { data, error } = await supabase.from('post_dukmarks').select(COLS).eq('post_id', postId).maybeSingle()
  if (error) { console.error('[덕마크] 조회 실패:', error.message); return null }
  return data ? toDukmark(data) : null
}

/** 덕마크 켜기·고치기 (input) / 끄기 (null). 성공하면 true. 작성자·덕질 노하우 글만 (RLS) */
export async function setPostDukmark(postId: string, input: DukmarkInput | null): Promise<boolean> {
  const supabase: any = createClient()
  if (!input) {
    const { error } = await supabase.from('post_dukmarks').delete().eq('post_id', postId)
    if (error) { console.error('[덕마크] 끄기 실패:', error.message); return false }
    return true
  }
  const uses = Array.from(new Set(input.uses.filter(u => USE_SET.has(u)))).slice(0, DUKMARK_MAX_USES)
  if (uses.length === 0) return false   // DB 도 용도 1개 이상만 받는다
  const summary = input.summary?.trim().slice(0, DUKMARK_SUMMARY_MAX) || null
  const fields = {
    uses,
    cover_url: input.coverUrl?.trim() || null,
    summary,
    // 사이트별 정보 — 주소는 정리·중복 제거한 순서대로, 정보는 같은 주소의 것을 붙인다 (site_urls 는 DB 가 sites 에서 만든다)
    sites: mergeSiteUrls(input.sites.map(s => s.url)).map(url => {
      const s = input.sites.find(x => cleanSiteUrl(x.url) === url)
      return {
        url,
        name: s?.name?.trim() || null,
        desc: s?.desc?.trim() || null,
        maker: s?.maker?.trim() || null,
        maker_links: (s?.makerLinks ?? []).filter(l => cleanSiteUrl(l.url)).slice(0, DUKMARK_MAX_MAKER_LINKS).map(l => ({ label: l.label.trim() || '링크', url: l.url.trim() })),
      }
    }),
    sources: (input.sources ?? []).filter(s => s.label.trim()).slice(0, DUKMARK_MAX_SOURCES).map(s => ({ label: s.label.trim(), url: s.url?.trim() || null })),
    by_maker: input.byMaker === true,
  }
  // upsert 는 쓰지 않는다 — 충돌 시 post_id 까지 UPDATE 하려 해서 열 단위 권한(post_id 는 UPDATE 불가)에 막힌다.
  // 있으면 고치고, 고친 줄이 없으면 새로 넣는다.
  const { data: updated, error: updErr } = await supabase.from('post_dukmarks').update(fields).eq('post_id', postId).select('post_id')
  if (updErr) { console.error('[덕마크] 저장 실패:', updErr.message); return false }
  if ((updated ?? []).length > 0) return true
  const { error } = await supabase.from('post_dukmarks').insert({ post_id: postId, ...fields })
  if (error) { console.error('[덕마크] 저장 실패:', error.message); return false }
  return true
}

/** 덕마크 탭 — 모든 덕마크 카드, 최신순. 작품·용도 필터는 화면에서 건다(아직 글이 적다) */
export async function getDukmarkCards(userId?: string | null, limit = 300): Promise<DukmarkCard[]> {
  const supabase: any = createClient()
  const { data, error } = await supabase
    .from('post_dukmarks').select(COLS)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error   // 화면에서 '다시 시도'
  return withPosts(data ?? [], userId)
}

/** 홈 '추천 덕마크' — 관리자가 고른 것만, 최근에 고른 순 */
export async function getFeaturedDukmarkCards(limit = 10): Promise<DukmarkCard[]> {
  const supabase: any = createClient()
  const { data, error } = await supabase
    .from('post_dukmarks').select(COLS)
    .not('featured_at', 'is', null)
    .order('featured_at', { ascending: false }).limit(limit)
  if (error) { console.error('[추천 덕마크] 조회 실패:', error.message); return [] }
  return withPosts(data ?? [])
}

/** 관리자: 홈 추천 켜기·끄기. 덕마크가 없는 글이면 false */
export async function setDukmarkFeatured(postId: string, on: boolean): Promise<boolean> {
  const supabase: any = createClient()
  const { data, error } = await supabase.rpc('set_dukmark_featured', { p_post_id: postId, p_on: on })
  if (error) { console.error('[추천 덕마크] 변경 실패:', error.message); return false }
  return data === true
}

/** 사이트 아이콘 — 링크 미리보기 저장분(link_previews)의 대표 이미지. 없으면 그 주소는 빠진다 */
export async function getSiteIcons(urls: string[]): Promise<Record<string, string | null>> {
  if (urls.length === 0) return {}
  const supabase: any = createClient()
  const { data, error } = await supabase.from('link_previews').select('url, image_url').in('url', urls)
  if (error) return {}
  return Object.fromEntries((data ?? []).filter((r: any) => r.image_url).map((r: any) => [String(r.url), String(r.image_url)]))
}
