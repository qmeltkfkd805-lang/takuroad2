import { linkBlocksIn, firstUrl } from '@/lib/utils/linkUrl'
import { CommunityPost, PostDukmark, DUKMARK_MAX_SITES } from '@/types/community-post'

/* 덕마크 카드·작성 폼에서 쓰는 도우미 (2026-10-18)
   - 사이트 주소: 글쓰기 편집기의 본문 링크로 자동으로 채우고, 작성자가 빼거나 더한다.
   - 대표 이미지·한 줄 소개: 따로 정하지 않으면 글의 첫 이미지·본문 앞부분. */

// 공유 링크에 붙어 오는 추적용 값 — 같은 사이트인데 주소가 달라 보이지 않게 뗀다
const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|igsh|igshid|xtok|obrf|si|ref_src|mibextid)$/i

/** 주소 정리 — http(s)만, 추적용 값과 끝의 #는 떼고. 못 쓰는 주소면 null */
export function cleanSiteUrl(raw: string | null | undefined): string | null {
  const u = firstUrl(raw?.trim())
  if (!u || /\/storage\/v1\/object\//.test(u)) return null   // 우리가 올린 첨부파일은 사이트가 아니다
  try {
    const url = new URL(u)
    for (const k of Array.from(url.searchParams.keys())) if (TRACKING_PARAMS.test(k)) url.searchParams.delete(k)
    url.hash = ''
    return url.toString()
  } catch { return null }
}

/** 순서 유지, 중복 제거, 최대 개수까지 */
export function mergeSiteUrls(...lists: (string | null | undefined)[][]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const list of lists) for (const raw of list) {
    const u = cleanSiteUrl(raw)
    if (!u) continue
    const key = u.replace(/\/$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
    if (out.length >= DUKMARK_MAX_SITES) return out
  }
  return out
}

/** 글쓰기 편집기 안의 링크들 (본문에 글자로 쓴 주소 + 붙여넣은 링크) */
export function siteUrlsIn(root: HTMLElement | null): string[] {
  return mergeSiteUrls(linkBlocksIn(root).map(l => l.url))
}

/** 카드 대표 이미지 */
export function dukmarkCover(post: CommunityPost, dm: PostDukmark): string | null {
  return dm.coverUrl ?? post.images[0] ?? null
}

/** 카드 한 줄 소개 — 정해 둔 게 없으면 본문 글자 앞부분 */
export function dukmarkSummary(post: CommunityPost, dm: PostDukmark, max = 60): string {
  if (dm.summary?.trim()) return dm.summary.trim()
  const text = (post.content ?? '')
    .replace(/<(br|\/div|\/p|\/li)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}
