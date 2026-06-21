import { createClient } from '@/lib/supabase/client'

export type ChangeReason = 'restock' | 'misinput_fix' | 'owner_update' | 'admin_update' | 'rollback' | 'other'

export const REASON_LABEL: Record<ChangeReason, string> = {
  restock: '재입고',
  misinput_fix: '오입력 수정',
  owner_update: '사장님 수정',
  admin_update: '운영자 수정',
  rollback: '되돌리기',
  other: '기타',
}

export async function logChange(params: {
  shopId: string
  targetTable: string
  fieldName: string
  oldValue: any
  newValue: any
  changeSource: 'owner' | 'admin' | 'user_suggestion'
  changedBy: string
  targetId?: string
  suggestionId?: string
  reason?: ChangeReason
}): Promise<void> {
  const supabase = createClient()
  await supabase.from('shop_change_logs').insert({
    shop_id: params.shopId,
    target_table: params.targetTable,
    target_id: params.targetId ?? null,
    field_name: params.fieldName,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    change_source: params.changeSource,
    changed_by: params.changedBy,
    suggestion_id: params.suggestionId ?? null,
    reason: params.reason ?? null,
  } as any)
}

// 샵 히스토리 (필터 가능)
export async function getShopHistory(shopId: string, filterTable?: string, limit = 50) {
  const supabase = createClient()
  let query = supabase
    .from('shop_change_logs')
    .select('*, profiles!shop_change_logs_changed_by_fkey ( nickname )')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filterTable) {
    query = query.eq('target_table', filterTable)
  }

  const { data, error } = await query
  if (error) {
    console.error('getShopHistory error:', JSON.stringify(error))
    return []
  }
  return data ?? []
}

// 되돌리기
export async function rollbackChange(logId: string, adminId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: log } = await supabase
    .from('shop_change_logs')
    .select('*')
    .eq('id', logId)
    .maybeSingle()

  if (!log) return false

  const targetId = log.target_id ?? log.shop_id
  const { error: applyError } = await supabase
    .from(log.target_table)
    .update({ [log.field_name]: log.old_value } as any)
    .eq('id', targetId)

  if (applyError) return false

  await supabase
    .from('shop_change_logs')
    .update({ is_rolled_back: true, rolled_back_by: adminId, rolled_back_at: new Date().toISOString() } as any)
    .eq('id', logId)

  await logChange({
    shopId: log.shop_id,
    targetTable: log.target_table,
    targetId: log.target_id,
    fieldName: log.field_name,
    oldValue: log.new_value,
    newValue: log.old_value,
    changeSource: 'admin',
    changedBy: adminId,
    reason: 'rollback',
  })

  return true
}