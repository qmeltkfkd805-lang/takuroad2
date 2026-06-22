import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { toShop } from '@/services/shopService'
import ShopDetailPage from '@/components/shop/ShopDetailPage'

interface Props {
  params: Promise<{ slug: string }>
}

// SSR용 샵 조회 (서버 클라이언트 사용)
async function getShopBySlugServer(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      hours, parking, parking_note, shop_link, floor_info, start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      added_by, owner_id,
      created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('slug', slug)
    .in('status', ['active', 'temporary_closed', 'closed'])
    .maybeSingle()

  if (!data) return null
  return toShop(data)
}

// SEO 메타데이터 자동 생성
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await getShopBySlugServer(slug)

  if (!shop) {
    return { title: '샵을 찾을 수 없어요' }
  }

  const title = `${shop.name} - 타쿠로드`
  const description = [
    shop.addr,
    shop.cats.join(', '),
    shop.description,
  ].filter(Boolean).join(' · ')

  const ogImage = shop.images[0] ?? '/og-default.png'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
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
