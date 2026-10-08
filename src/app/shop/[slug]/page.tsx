import { Metadata } from 'next'
import { cache } from 'react'
import { pageMeta, toDescription } from '@/lib/seo/pageMeta'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { toShop } from '@/services/shopService'
import ShopDetailPage from '@/components/shop/ShopDetailPage'

interface Props {
  params: Promise<{ slug: string }>
}

// SSR용 샵 조회 (서버 클라이언트 사용) — 메타데이터와 화면이 같은 요청 안에서 한 번만 읽도록 cache
const getShopBySlugServer = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shops')
    .select(`
      id, slug, name, name_en, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      place_id, floor, unit,
      places ( slug, name, lat, lng ),
      hours, parking, parking_note, shop_link, sns_links, phone, reservation_url, reservation_required, floor_info, branches, start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      temporary_holiday_start, temporary_holiday_end, temporary_holiday_message,
      added_by, owner_id,
      created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      cats
    `)
    .eq('slug', slug)
    .in('status', ['active', 'temporary_closed', 'closed'])
    .maybeSingle()

  if (!data) return null
  return toShop(data)
})

// SEO 메타데이터 자동 생성
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await getShopBySlugServer(slug)

  if (!shop) {
    return { title: '샵을 찾을 수 없어요', robots: { index: false, follow: true } }
  }

  // 제목 뒤 '| 타쿠로드'는 layout 이 붙인다 (예전엔 '토비토 - 타쿠로드 | 타쿠로드'로 두 번 붙었다)
  const title = shop.region ? `${shop.name} (${shop.region})` : shop.name
  const description = toDescription([
    shop.addr,
    shop.cats.join(', '),
    shop.description,
  ].filter(Boolean).join(' · '), 160)

  return pageMeta({
    title,
    description,
    path: `/shop/${encodeURIComponent(slug)}`,
    image: shop.images[0],
  })
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params
  const shop = await getShopBySlugServer(slug)

  if (!shop) notFound()

  // JSON-LD 구조화 데이터 (구글 리치 결과)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: shop.name,
    description: shop.description ?? undefined,
    address: shop.addr ? {
      '@type': 'PostalAddress',
      streetAddress: shop.addr,
      addressCountry: shop.country,
    } : undefined,
    geo: shop.lat && shop.lng ? {
      '@type': 'GeoCoordinates',
      latitude: shop.lat,
      longitude: shop.lng,
    } : undefined,
    aggregateRating: shop.rating_count > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: shop.rating_avg,
      reviewCount: shop.rating_count,
    } : undefined,
    image: shop.images[0] ?? undefined,
    url: shop.shop_link ?? undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShopDetailPage shop={shop} />
    </>
  )
}
