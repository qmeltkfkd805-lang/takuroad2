import { createClient } from '@/lib/supabase/client'

export interface CompletenessCheck {
  label: string
  isComplete: boolean
}

export async function getShopCompleteness(shopId: string): Promise<{ percent: number; checks: CompletenessCheck[] }> {
  const supabase = createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('hours, twitter_url, instagram_url, shop_link, phone, floor_info, addr')
    .eq('id', shopId)
    .maybeSingle()

  // 메인(대표) 사진 등록 여부 — is_cover=true 인 사진
  const { count: coverCount } = await supabase
    .from('shop_images')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_cover', true)

  const { count: tagCount } = await supabase
    .from('shop_tags')
    .select('shop_id', { count: 'exact', head: true })
    .eq('shop_id', shopId)

  const { count: productCount } = await supabase
    .from('shop_products')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_active', true)

  // 판매 굿즈 종류 (등록 위저드에서 저장하는 곳)
  const { count: goodsCategoryCount } = await supabase
    .from('shop_goods_categories')
    .select('shop_id', { count: 'exact', head: true })
    .eq('shop_id', shopId)

  const { count: activeEventCount } = await supabase
    .from('shop_events')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_active', true)

  const checks: CompletenessCheck[] = [
    { label: '주소', isComplete: !!shop?.addr },
    { label: '영업시간', isComplete: !!shop?.hours },
    { label: '메인 사진 등록', isComplete: (coverCount ?? 0) > 0 },
    { label: '취급 작품 등록', isComplete: (tagCount ?? 0) > 0 },
    { label: '판매 굿즈 종류', isComplete: (goodsCategoryCount ?? 0) > 0 || (productCount ?? 0) > 0 },
    { label: '진행중 이벤트', isComplete: (activeEventCount ?? 0) > 0 },
    { label: 'SNS 연결', isComplete: !!(shop?.shop_link || shop?.twitter_url || shop?.instagram_url) },
    { label: '전화번호', isComplete: !!shop?.phone },
  ]

  const percent = Math.round((checks.filter(c => c.isComplete).length / checks.length) * 100)
  return { percent, checks }
}