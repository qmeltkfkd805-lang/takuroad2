import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { toShop } from '@/services/shopService'
import HolidayManage from '@/components/shop/HolidayManage'

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

export default async function Page({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const shop = await getShop(slug)
  if (!shop) notFound()
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = (prof as any)?.role === 'admin'
  if (!isAdmin && (!shop.is_claimed || shop.owner_id !== user.id)) redirect(`/shop/${slug}`)
  return <HolidayManage shop={shop} />
}