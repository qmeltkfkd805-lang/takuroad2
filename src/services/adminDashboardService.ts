import { createClient } from '@/lib/supabase/client'

export async function getAdminTodoSummary() {
  const supabase = createClient()

  const { count: pendingSuggestions } = await supabase
    .from('shop_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: pendingVerifyRequests } = await supabase
    .from('shop_verify_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  // 180일 이상 정보 미갱신 + 방문수 높은 순 (인기 있는데 오래된 정보)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 180)

  const { data: staleShops } = await supabase
    .from('shops')
    .select('id, name, slug, visit_count, info_last_confirmed_at')
    .lt('info_last_confirmed_at', cutoff.toISOString())
    .eq('status', 'active')
    .order('visit_count', { ascending: false })
    .limit(5)

  // 한번도 확인 안 된 굿즈 정보
  const { count: unconfirmedProducts } = await supabase
    .from('shop_products')
    .select('id', { count: 'exact', head: true })
    .eq('confirm_count', 0)
    .eq('is_active', true)

  return {
    pendingSuggestions: pendingSuggestions ?? 0,
    pendingVerifyRequests: pendingVerifyRequests ?? 0,
    staleShops: staleShops ?? [],
    unconfirmedProducts: unconfirmedProducts ?? 0,
  }
}