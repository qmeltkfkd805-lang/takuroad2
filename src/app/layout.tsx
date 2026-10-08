import type { Metadata } from 'next'
import { AuthProvider } from '@/components/layout/AuthProvider'
import AppShell from '@/components/layout/AppShell'
import { env } from '@/lib/env'
import './globals.css'

const SITE_URL = 'https://www.takuroad.kr'
const OG_IMAGE = { url: '/og-default.png', width: 1200, height: 630, alt: '타쿠로드 TAKUROAD' }

export const metadata: Metadata = {
  // 공유 미리보기(카카오톡 등)는 이미지 주소가 절대 주소여야 한다 → 상대 경로의 기준 주소
  metadataBase: new URL(SITE_URL),
  title: {
    default: '타쿠로드 | 덕후의 성지순례 지도',
    template: '%s | 타쿠로드',
  },
  description: '한국의 애니·오타쿠 쇼핑 명소를 한눈에. 피규어, 굿즈, 카드, 팝업스토어를 지도에서 찾아보세요.',
  keywords: ['오타쿠', '성지순례', '피규어', '굿즈', '애니', '팝업스토어', '덕후', '타쿠로드'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '타쿠로드',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '타쿠로드',
    // url 은 여기 두지 않는다 — 두면 모든 페이지의 og:url 이 홈 주소가 된다. 페이지마다 lib/seo/pageMeta 로 단다
    title: '타쿠로드 | 덕후의 성지순례 지도',
    description: '한국의 애니·오타쿠 쇼핑 명소를 한눈에. 피규어, 굿즈, 카드, 팝업스토어를 지도에서 찾아보세요.',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: '타쿠로드 | 덕후의 성지순례 지도',
    description: '한국의 애니·오타쿠 쇼핑 명소를 한눈에. 피규어, 굿즈, 카드, 팝업스토어를 지도에서 찾아보세요.',
    images: [OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
  // 검색엔진 사이트 소유 확인 — <meta name="naver-site-verification" …> 로 출력된다
  verification: {
    other: {
      'naver-site-verification': '791033d87bd5712f00c01979fb39fe6e5b12ebfb',
    },
  },
}

export const viewport = {
  themeColor: '#e8006f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cute+Font&family=Noto+Sans+KR:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
        {/* 파비콘·홈 화면 아이콘은 app/icon.png · app/apple-icon.png · app/favicon.ico 로 Next가 자동 연결 */}
        <script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${env.kakao.appKey}&libraries=services&autoload=false`}
          async
        />
        {/* 🔎 화면 진단(?diag=1)일 때만: 화면이 뜨기 전 오류(하이드레이션 등)를 모아 둔다 → DiagOverlay 가 보여줌 */}
        <script
          dangerouslySetInnerHTML={{ __html: `(function(){try{if(!/[?&]diag=1/.test(location.search))return;var a=window.__TAKU_DIAG_ERRORS=[];var p=function(k,m){a.length<50&&a.push(k+': '+String(m).slice(0,300))};window.addEventListener('error',function(e){p('error',e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno)});window.addEventListener('unhandledrejection',function(e){p('promise',e.reason&&e.reason.message||e.reason)});var ce=console.error;console.error=function(){try{p('console',Array.prototype.map.call(arguments,function(x){return x&&x.message||x}).join(' '))}catch(_){}return ce.apply(console,arguments)}}catch(_){}})()` }}
        />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}