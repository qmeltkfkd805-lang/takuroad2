import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { toShop } from '@/services/shopService'
import ShopForm from '@/components/shop/ShopForm'

interface Props {
  params: Promise<{ slug: string }>
}

async function getShop(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      hours, parking, parking_note, shop_link, sns_links, phone, floor_info, start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      temporary_holiday_start, temporary_holiday_end, temporary_holiday_message,
      added_by, owner_id, created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      cats
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return null
  return toShop(data)
}

export default async function ShopEditPage({ params }: Props) {
  const { slug } = await params
  const shop = await getShop(slug)
  if (!shop) notFound()

  return <ShopForm mode="edit" shop={shop} />
}