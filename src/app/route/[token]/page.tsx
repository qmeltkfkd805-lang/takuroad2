import { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import RouteDetailGate from '@/components/route/RouteDetailGate'
import { fetchRouteDetail } from '@/lib/route/routeDetailQuery'
import { cache } from 'react'
import { pageMeta, toDescription } from '@/lib/seo/pageMeta'

interface Props {
  params: Promise<{ token: string }>
}

/* 페이지 캐시 (2026-10-24) — 같은 루트 페이지는 5분 동안 한 번 만든 걸 그대로 보여준다.
   예전엔 로그인 쿠키를 읽어서(작성자 확인·차단 확인) 봇이 긁을 때마다 새로 그렸다.
   - 서버는 비로그인 권한으로 공개·공식 루트만 읽는다 (routes RLS: 공유·공식·본인만 보임).
   - 서버가 못 읽은 루트(비공개·없는 루트)는 빈 화면만 캐시하고, 브라우저가 작성자 세션으로 다시 읽는다.
   - 차단 관계 확인(작성자 닉네임 가리기)도 브라우저에서 한다 → RouteDetailGate.
   루트를 고치거나 공개 상태를 바꾸면 purgeRoutePages()가 바로 비운다 (lib/cache/routePageCache.ts). */
export const revalidate = 300
// 빌드 때 미리 만들지 않고, 처음 열릴 때 만들어서 캐시한다
export async function generateStaticParams() { return [] }

const fetchRoute = cache((token: string) => fetchRouteDetail(createPublicClient(), token))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const route = await fetchRoute(token)
  // 비공개(임시 저장)이거나 없는 루트 — 서버에선 구분이 안 된다. 검색에 싣지 않는다
  if (!route) return { title: '덕질 루트', robots: { index: false, follow: true } }
  const n = route.route_shops?.length ?? 0
  return pageMeta({
    title: `${route.title} · 덕질 루트`,
    description: toDescription(route.description) || `${n}곳의 굿즈샵·성지를 도는 덕질 루트예요.`,
    path: `/route/${encodeURIComponent(token)}`,
    image: route.cover_image_url,
  })
}

export default async function RouteSharePage({ params }: Props) {
  const { token } = await params
  const route = await fetchRoute(token)
  return <RouteDetailGate route={route} token={token} />
}
