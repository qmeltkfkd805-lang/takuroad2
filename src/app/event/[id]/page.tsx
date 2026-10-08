import type { Metadata } from 'next'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import EventDetailPage from '@/components/event/EventDetailPage'
import { pageMeta, toDescription, SITE_URL } from '@/lib/seo/pageMeta'

/* 이벤트 상세 — 화면은 예전처럼 EventDetailPage(브라우저)가 그린다.
   여기서는 검색·공유 정보와 구글 이벤트 구조화 데이터(JSON-LD)만 서버에서 만든다.
   (예전엔 모든 이벤트 페이지가 같은 제목·설명이라 검색에서 구분이 안 됐다) */
interface Props { params: Promise<{ id: string }> }

const TYPE_LABEL: Record<string, string> = { popup: '팝업스토어', collab_cafe: '콜라보 카페', exhibition: '전시', official_event: '행사', goods_added: '굿즈 입고' }

const getEvent = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('id, title, type, start_date, end_date, place_name, place_addr, cover_url, description, deleted_at, tags ( name, cover_url ), shops ( name, addr )')
    .eq('id', id)
    .maybeSingle()
  return (data as any) ?? null
})

const fmt = (d: string | null) => (d ? d.slice(0, 10).replace(/-/g, '.') : '')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const ev = await getEvent(id)
  if (!ev || ev.deleted_at) return { title: '이벤트를 찾을 수 없어요', robots: { index: false, follow: true } }

  const type = TYPE_LABEL[ev.type] ?? '이벤트'
  const work = ev.tags?.name ? `${ev.tags.name} ` : ''
  const place = ev.shops?.name ?? ev.place_name ?? ''
  const period = ev.start_date ? `${fmt(ev.start_date)}${ev.end_date && ev.end_date !== ev.start_date ? ` ~ ${fmt(ev.end_date)}` : ''}` : ''
  const lead = [period, place].filter(Boolean).join(' · ')
  const description = toDescription([lead, ev.description].filter(Boolean).join(' — '), 160)
    || `${work}${type} 정보를 타쿠로드에서 확인하세요.`

  return pageMeta({
    title: `${ev.title} · ${type}`,
    description,
    path: `/event/${id}`,
    image: ev.cover_url || ev.tags?.cover_url,
  })
}

export default async function Page({ params }: Props) {
  const { id } = await params
  const ev = await getEvent(id)

  // 구글 '이벤트' 검색 결과용 — 시작일과 장소가 있을 때만 (없으면 구글이 무효로 본다)
  const placeName = ev?.shops?.name ?? ev?.place_name ?? null
  const placeAddr = ev?.shops?.addr ?? ev?.place_addr ?? null
  const jsonLd = ev && !ev.deleted_at && ev.start_date && (placeName || placeAddr) ? {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ev.title,
    startDate: ev.start_date,
    endDate: ev.end_date ?? ev.start_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: placeName ?? placeAddr,
      address: { '@type': 'PostalAddress', streetAddress: placeAddr ?? placeName, addressCountry: 'KR' },
    },
    image: ev.cover_url || ev.tags?.cover_url || undefined,
    description: toDescription(ev.description, 300) || undefined,
    url: `${SITE_URL}/event/${id}`,
  } : null

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <EventDetailPage />
    </>
  )
}
