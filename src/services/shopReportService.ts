import { createClient } from '@/lib/supabase/client'

// 샵 정보 신고 (간단 버전 — shop_suggestions 활용)
export async function reportShopIssue(shopId: string, userId: string, reason: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_suggestions')
    .insert({
      shop_id: shopId,
      user_id: userId,
      suggestion_type: 'general_edit',
      payload: { type: 'report', reason },
      status: 'pending',
    } as any)
  return !error
}

// 신고(제보) 많은 순으로 샵 목록 (운영자 대시보드용)
export async function getMostReportedShops(limit = 20) {
  const supabase = createClient()

  const { data } = await supabase
    .from('shop_suggestions')
    .select('shop_id, shops ( id, name, slug )')
    .eq('status', 'pending')

  if (!data) return []

  const countMap = new Map<string, { shop: any; count: number }>()
  for (const row of data as any[]) {
    if (!row.shops) continue
    const existing = countMap.get(row.shop_id)
    if (existing) {
      existing.count += 1
    } else {
      countMap.set(row.shop_id, { shop: row.shops, count: 1 })
    }
  }

  return Array.from(countMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// 특정 샵의 신고/제보 내역
export async function getShopSuggestions(shopId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shop_suggestions')
    .select('id, suggestion_type, payload, status, created_at, profiles!shop_suggestions_user_id_fkey ( nickname )')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getShopSuggestions error:', JSON.stringify(error))
    return []
  }
  return data ?? []
}

export async function resolveSuggestion(suggestionId: string, status: 'approved' | 'rejected', adminId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_suggestions')
    .update({ status, reviewed_by: adminId, reviewed_at: new Date().toISOString() } as any)
    .eq('id', suggestionId)
  return !error
}