import { createClient } from '@/lib/supabase/client'

export async function getAdminTodoSummary() {
  const supabase = createClient()
  const { count: pendingSuggestions } = await supabase.from('shop_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  const { count: pendingVerifyRequests } = await supabase.from('shop_verify_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 180)
  const { data: staleShops } = await supabase.from('shops').select('id, name, slug, visit_count, info_last_confirmed_at').lt('info_last_confirmed_at', cutoff.toISOString()).eq('status', 'active').order('visit_count', { ascending: false }).limit(5)
  const { count: unconfirmedProducts } = await supabase.from('shop_products').select('id', { count: 'exact', head: true }).eq('confirm_count', 0).eq('is_active', true)
  return {
    pendingSuggestions: pendingSuggestions ?? 0,
    pendingVerifyRequests: pendingVerifyRequests ?? 0,
    staleShops: staleShops ?? [],
    unconfirmedProducts: unconfirmedProducts ?? 0,
  }
}

export interface AdminStats { works: number; shops: number; events: number; banners: number; members: number; favorites: number; newMembersToday: number }

// 관리자 통계는 전용 RPC 하나로 통일 (RLS 우회 + 호출 1번). 지표 추가는 함수 SQL만 수정.
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_dashboard_stats')
  if (error || !data) {
    console.error('[대시보드 통계] rpc:', error)
    return { works: 0, shops: 0, events: 0, banners: 0, members: 0, favorites: 0, newMembersToday: 0 }
  }
  const d = data as any
  return {
    works: d.works ?? 0,
    shops: d.shops ?? 0,
    events: d.events ?? 0,
    banners: d.banners ?? 0,
    members: d.members ?? 0,
    favorites: d.favorites ?? 0,
    newMembersToday: d.new_members_today ?? 0,
  }
}

export interface TopShop { id: string; name: string; slug: string; visit_count: number }

export async function getTopShops(limit = 5): Promise<TopShop[]> {
  const supabase = createClient()
  const { data } = await supabase.from('shops').select('id, name, slug, visit_count').eq('status', 'active').order('visit_count', { ascending: false }).limit(limit)
  return (data ?? []) as TopShop[]
}
