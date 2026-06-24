import { createClient } from '@/lib/supabase/client'

export interface NewSubmission {
  tagId: string
  type: string
  title: string
  placeSnapshot: any
  placeDetail: string | null
  startDate: string | null
  endDate: string | null
  sourceUrl: string
  description: string | null
}

export async function createEventSubmission(s: NewSubmission, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('event_submissions').insert({
    tag_id: s.tagId,
    type: s.type,
    title: s.title,
    place_snapshot: s.placeSnapshot,
    place_detail: s.placeDetail,
    start_date: s.startDate,
    end_date: s.endDate,
    source_url: s.sourceUrl,
    description: s.description,
    submitted_by: userId,
  } as any)

  if (error) { console.error('[제보 저장 실패]', error); return false }
  return true
}

// 검수용 제보 한 건 (place_snapshot 파싱 + 작품명/제보자명 조인)
export interface PendingSubmission {
  id: string
  tagId: string
  tagName: string
  type: string
  title: string
  placeSnapshot: any        // 카카오 원본 (이름/주소/좌표)
  placeDetail: string | null
  startDate: string | null
  endDate: string | null
  sourceUrl: string
  description: string | null
  submitterName: string
  createdAt: string
}

// 검수 대기(pending) 제보 목록 — 관리자용. 최신순.
export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('event_submissions')
    .select('id, tag_id, type, title, place_snapshot, place_detail, start_date, end_date, source_url, description, created_at, submitted_by')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[검수 조회 실패]', error.message, error.code, error.details)
    return []
  }
  const rows = data ?? []
  if (rows.length === 0) return []

  // 작품 이름 + 제보자 이름을 따로 모아서 붙임 (조인 모호성 회피)
  const tagIds = [...new Set(rows.map((r: any) => r.tag_id).filter(Boolean))]
  const userIds = [...new Set(rows.map((r: any) => r.submitted_by).filter(Boolean))]

  const [{ data: tags }, { data: profiles }] = await Promise.all([
    supabase.from('tags').select('id, name').in('id', tagIds),
    userIds.length
      ? supabase.from('profiles').select('id, nickname').in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const tagMap = new Map((tags ?? []).map((t: any) => [t.id, t.name]))
  const userMap = new Map((profiles ?? []).map((p: any) => [p.id, p.nickname]))

  return rows.map((r: any) => ({
    id: r.id,
    tagId: r.tag_id,
    tagName: tagMap.get(r.tag_id) ?? '(작품 없음)',
    type: r.type,
    title: r.title,
    placeSnapshot: r.place_snapshot,
    placeDetail: r.place_detail,
    startDate: r.start_date,
    endDate: r.end_date,
    sourceUrl: r.source_url,
    description: r.description,
    submitterName: userMap.get(r.submitted_by) ?? '익명',
    createdAt: r.created_at,
  }))
}