import { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'
import { getPlaceBySlug, PLACE_TYPE_LABEL } from '@/services/placeService'
import PlaceDetailPage from '@/components/place/PlaceDetailPage'
import { pageMeta, toDescription } from '@/lib/seo/pageMeta'

interface Props {
  params: Promise<{ slug: string }>
}

/* 페이지 캐시 (2026-10-24) — 같은 장소 페이지는 5분 동안 한 번 만든 걸 그대로 보여준다.
   예전엔 로그인 쿠키를 읽는 클라이언트를 써서 봇이 긁을 때마다 새로 그렸다.
   장소·입점 샵·이벤트가 바뀌면 purgePlacePages()가 바로 비운다 (lib/cache/placePageCache.ts).
   오늘 시작·종료하는 이벤트는 최대 5분 늦게 바뀐다. */
export const revalidate = 300
// 빌드 때 미리 만들지 않고, 처음 열릴 때 만들어서 캐시한다
export async function generateStaticParams() { return [] }

// 메타데이터와 화면이 같은 요청 안에서 한 번만 읽도록 cache (예전엔 장소·샵·이벤트를 두 번씩 읽었다)
// 비로그인(anon) 권한으로 읽는다 — 장소·공개 샵·이벤트는 누가 봐도 같은 정보
const getPlace = cache((slug: string) => getPlaceBySlug(createPublicClient(), slug))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const place = await getPlace(slug)
  if (!place) return { title: '장소를 찾을 수 없어요', robots: { index: false, follow: true } }

  const label = PLACE_TYPE_LABEL[place.placeType] ?? '장소'
  // 제목 뒤 '| 타쿠로드'는 layout 이 붙인다 (예전엔 두 번 붙었다)
  return pageMeta({
    title: `${place.name} · ${label}`,
    description: toDescription(place.description) || `${place.name}의 입점 샵과 진행 중인 이벤트를 확인하세요.`,
    path: `/place/${encodeURIComponent(slug)}`,
    image: place.coverUrl,
  })
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const place = await getPlace(slug)
  if (!place) notFound()

  return <PlaceDetailPage place={place} />
}
