import type { Metadata } from 'next'

/* 페이지마다 검색·공유 정보를 같은 모양으로 만든다.
   - 제목: "<제목> | 타쿠로드" (layout 의 title.template 이 뒤를 붙인다 — 여기서 '타쿠로드'를 또 붙이지 말 것)
   - 대표 주소(canonical)와 공유 주소(og:url)를 그 페이지 주소로
     (예전엔 layout 의 og:url 이 모든 페이지에 홈 주소로 붙어서, 카카오톡 등에 어떤 페이지를 공유해도 홈 주소로 잡혔다)
   - 공유 이미지가 없으면 기본 이미지 */
export const SITE_URL = 'https://www.takuroad.kr'
export const SITE_NAME = '타쿠로드'
export const DEFAULT_OG_IMAGE = '/og-default.png'

/** 글자를 검색 설명에 맞게 — HTML 태그 빼고, 공백 정리, 길면 자른다 */
export function toDescription(text: string | null | undefined, max = 150): string {
  const plain = (text ?? '')
    .replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|div|li|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain
}

export function pageMeta(opts: {
  title: string
  description: string
  /** '/shop/tobito' 처럼 사이트 안 경로 */
  path: string
  image?: string | null
  type?: 'website' | 'article'
  noindex?: boolean
}): Metadata {
  const url = SITE_URL + opts.path
  const image = opts.image || DEFAULT_OG_IMAGE
  const fullTitle = `${opts.title} | ${SITE_NAME}`
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      type: opts.type ?? 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      url,
      title: fullTitle,
      description: opts.description,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: opts.description,
      images: [image],
    },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}
