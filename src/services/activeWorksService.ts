import { createClient } from '@/lib/supabase/client'

export interface ActiveWork {
  id: string
  name: string
  slug: string
}

// 최근 7일 작품별 활동(검색 고유 사용자 + 최애/관심 등록) 합산 상위 N개.
// DB 함수(get_active_works)로 집계 — 개별 기록은 노출 안 하고 합계만.
export async function getActiveWorks(limit = 6): Promise<ActiveWork[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_active_works', {
    days: 7,
    max_count: limit,
  })
  if (error) {
    console.error('[활발한작품] rpc:', error)
    return []
  }
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, slug: r.slug }))
}