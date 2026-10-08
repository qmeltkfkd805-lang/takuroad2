import type { MetadataRoute } from 'next'

// 실제 주소는 www — takuroad.kr 로 들어오면 www 로 넘어간다(Vercel 도메인 설정). 사이트맵·robots 의 주소도 www 로 맞춘다
// (예전엔 takuroad.kr 로 적혀 있어서 사이트맵의 모든 주소가 넘겨주기(리다이렉트)를 거쳤다)
const SITE_URL = 'https://www.takuroad.kr'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/debug/',
        '/dev/',
        '/login/',
        '/notifications/',
        '/profile/',
        '/test/',
        '/event/new/',
        '/event/submit/',
        '/event/*/edit',
        '/route/*/edit',
        '/shop/new/',
        '/shop/*/edit',
        '/shop/*/manage/',
        '/support/notice/write/',
        '/work/*/edit',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
