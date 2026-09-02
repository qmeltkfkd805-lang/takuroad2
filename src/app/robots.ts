import type { MetadataRoute } from 'next'

const SITE_URL = 'https://takuroad.kr'

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
