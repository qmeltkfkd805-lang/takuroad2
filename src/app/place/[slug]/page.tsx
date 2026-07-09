import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlaceBySlug, PLACE_TYPE_LABEL } from '@/services/placeService'
import PlaceDetailPage from '@/components/place/PlaceDetailPage'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const place = await getPlaceBySlug(supabase, slug)
  if (!place) return { title: '장소를 찾을 수 없어요 · 타쿠로드' }

  const label = PLACE_TYPE_LABEL[place.placeType] ?? '장소'
  return {
    title: `${place.name} · ${label} | 타쿠로드`,
    description: place.description ?? `${place.name}의 입점 샵과 진행 중인 이벤트를 확인하세요.`,
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const place = await getPlaceBySlug(supabase, slug)
  if (!place) notFound()

  return <PlaceDetailPage place={place} />
}
