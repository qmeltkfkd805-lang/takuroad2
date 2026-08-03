import { notFound } from 'next/navigation'
import Link from 'next/link'
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
      place_id, floor, unit,
      places ( slug, name, lat, lng ),
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

  // 인증된 매장은 사장님(owner_id) 또는 관리자만 수정 가능
  if (shop.is_claimed) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let isAdmin = false
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      isAdmin = (prof as any)?.role === 'admin'
    }
    const isOwner = !!user && shop.owner_id === user.id
    if (!isOwner && !isAdmin) {
      return (
        <div style={{ maxWidth: 460, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 9999, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 10px' }}>사장님 인증 매장이에요</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 22px' }}>
            <b style={{ color: 'var(--text)' }}>{shop.name}</b>은(는) 사장님 인증이 완료된 매장이라, 등록된 사장님만 정보를 수정할 수 있어요.
          </p>
          <Link href={`/shop/${shop.slug}`} style={{ display: 'inline-block', padding: '12px 22px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
            매장으로 돌아가기
          </Link>
        </div>
      )
    }
  }

  return <ShopForm mode="edit" shop={shop} />
}