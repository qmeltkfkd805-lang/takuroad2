import { createClient } from '@/lib/supabase/client'

// 작품(tag)에 일어난 사건. type별로 표시만 다르게.
export interface WorkEvent {
  id: string
  tagId: string
  type: string
  shopId: string | null
  title: string | null
  createdAt: string
}

// 한 작품의 최근 Event들 (작품 홈 "새로운 소식"용). 최신순.
export async function getEventsByTag(tagId: string, limit = 20): Promise<WorkEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, created_at')
    .eq('tag_id', tagId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []).map((e: any) => ({
    id: e.id,
    tagId: e.tag_id,
    type: e.type,
    shopId: e.shop_id,
    title: e.title,
    createdAt: e.created_at,
  }))
}