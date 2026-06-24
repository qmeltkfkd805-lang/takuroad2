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