import { createClient } from '@/lib/supabase/client'

export interface InfoConfirmationStats {
  count: number
  lastConfirmedAt: string | null
  recentSightingCount: number
}

// 확인하기 (UPSERT — 이미 확인한 적 있으면 시각만 갱신)
export async function confirmInfo(
  shopId: string,
  targetTable: 'shops' | 'shop_products',
  targetField: string | null,
  targetId: string,
  userId: string,
  checkInId?: string | null
): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_info_confirmations')
    .upsert(
      {
        shop_id: shopId,
        target_table: targetTable,
        target_field: targetField,
        target_id: targetId,
        user_id: userId,
        confirmed_at: new Date().toISOString(),
        via_check_in_id: checkInId ?? null,
      } as any,
      { onConflict: 'target_table,target_field,target_id,user_id' }
    )
  return !error
}

// 확인 통계 (몇 명이, 언제 마지막으로)
export async function getConfirmationStats(
  targetTable: string,
  targetField: string | null,
  targetId: string
): Promise<InfoConfirmationStats> {
  const supabase = createClient()

  let query = supabase
    .from('shop_info_confirmations')
    .select('confirmed_at, via_check_in_id', { count: 'exact' })
    .eq('target_table', targetTable)
    .eq('target_id', targetId)

  if (targetField) {
    query = query.eq('target_field', targetField)
  } else {
    query = query.is('target_field', null)
  }

  const { data, count } = await query.order('confirmed_at', { ascending: false })

  return {
    count: count ?? 0,
    lastConfirmedAt: data?.[0]?.confirmed_at ?? null,
    recentSightingCount: (data ?? []).filter(d => d.via_check_in_id).length,
  }
}

// 오늘 이미 체크인했는지 (확인 버튼 문구 분기용)
export async function hasCheckedInToday(userId: string, shopId: string): Promise<string | null> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .gte('created_at', `${today}T00:00:00`)
    .maybeSingle()
  return data?.id ?? null
}