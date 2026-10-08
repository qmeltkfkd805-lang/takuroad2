/* robots.txt — 예전 src/app/robots.ts 를 대신한다.
   다음(Daum) 웹마스터도구는 사이트 소유 확인을 robots.txt 안의 주석 한 줄(#DaumWebMasterTool:…)로 하는데,
   robots.ts(MetadataRoute.Robots) 방식으로는 주석 줄을 넣을 수 없어서 글자를 직접 써서 내보낸다.
   내용(허용·막는 경로, 사이트맵 주소, Host)은 예전과 같다.

   실제 주소는 www — takuroad.kr 로 들어오면 www 로 넘어간다(Vercel 도메인 설정). */
const SITE_URL = 'https://www.takuroad.kr'

// 다음 웹마스터도구 사이트 소유 확인 (지우면 다음 검색 등록이 풀린다)
const DAUM_VERIFY = '#DaumWebMasterTool:9ac5ed92d1af40aa0b761bf4561206141692679f404b5c61b83901c926db8a2b:8SjbiuNdTrBspUonAA9dvw=='

const DISALLOW = [
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
]

export const dynamic = 'force-static'

export function GET() {
  const body = [
    DAUM_VERIFY,
    '',
    'User-Agent: *',
    'Allow: /',
    ...DISALLOW.map(p => `Disallow: ${p}`),
    '',
    `Host: ${SITE_URL}`,
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
