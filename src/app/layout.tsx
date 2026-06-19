import type { Metadata } from 'next'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { env } from '@/lib/env'
import './globals.css'

export const metadata: Metadata = {
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
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
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
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${env.kakao.appKey}&libraries=services&autoload=false`}
          async
        />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}