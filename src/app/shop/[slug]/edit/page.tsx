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
      id, slug, name, name_en, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      place_id, floor, unit,
      places ( slug, name, lat, lng ),
      hours, parking, parking_note, shop_link, sns_links, phone, reservation_url, reservation_required, floor_info, branches, start_date, end_date, event_info,
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

  /* 샵을 직접 고칠 수 있는 사람 (2026-10-10 — DB 정책 shops_update_scoped 와 같은 기준)
       관리자 / 인증된 매장의 사장님(owner_id) / 미인증 매장을 처음 등록한 사람(added_by)
     그 외 사용자는 샵 화면의 '정보 수정 제안'으로 보낸다.
     로그인 전이면 그대로 두고 ShopForm 이 로그인 화면으로 보낸다. */
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const isAdmin = (prof as any)?.role === 'admin'
    const canEdit = isAdmin
      || (shop.is_claimed && shop.owner_id === user.id)
      || (!shop.is_claimed && shop.added_by === user.id)
    if (!canEdit) {
      return (
        <div style={{ maxWidth: 460, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 9999, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 10px' }}>
            {shop.is_claimed ? '사장님 인증 매장이에요' : '직접 수정할 수 없는 샵이에요'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 22px' }}>
            <b style={{ color: 'var(--text)' }}>{shop.name}</b>
            {shop.is_claimed
              ? '은(는) 사장님 인증이 완료된 매장이라, 등록된 사장님만 정보를 수정할 수 있어요.'
              : '의 정보는 처음 등록한 분과 타쿠로드만 고칠 수 있어요.'}
            <br />틀린 정보가 있다면 샵 화면 ‘기본 정보’의 <b style={{ color: 'var(--text)' }}>정보 수정 제안</b>으로 알려 주세요. 확인 후 반영할게요.
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