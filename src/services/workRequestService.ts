import { createClient } from '@/lib/supabase/client'

/* 작품 추가 요청 — 일반 사용자는 작품을 직접 만들 수 없고 여기로 요청한다.
   관리자가 검토해 직접 등록한다(자동 생성하지 않는다). 보상은 없다. */

export type WorkRequestStatus = 'pending' | 'approved' | 'rejected'

export const WORK_REQUEST_STATUS: { key: WorkRequestStatus; label: string }[] = [
  { key: 'pending', label: '검토 중' },
  { key: 'approved', label: '등록됨' },
  { key: 'rejected', label: '반려' },
]

export function workRequestStatusLabel(s: string): string {
  return WORK_REQUEST_STATUS.find(x => x.key === s)?.label ?? s
}

export interface WorkRequest {
  id: string
  user_id: string
  name: string
  english_name: string | null
  ref_url: string | null
  note: string | null
  status: WorkRequestStatus
  admin_note: string | null
  reviewed_at: string | null
  created_tag_id: string | null
  created_at: string
}

export interface NewWorkRequest {
  name: string
  englishName?: string
  refUrl?: string
  note?: string
}

export async function createWorkRequest(userId: string, r: NewWorkRequest): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await supabase.from('work_requests').insert({
    user_id: userId,
    name: r.name.trim(),
    english_name: r.englishName?.trim() || null,
    ref_url: r.refUrl?.trim() || null,
    note: r.note?.trim() || null,
  } as any)
  if (error) {
    // 23505 = uq_work_requests_pending — 같은 사람이 같은 작품을 또 요청
    if (error.code === '23505') return { ok: false, error: '같은 작품을 이미 요청하셨어요. 검토 중입니다.' }
    console.error('[createWorkRequest]', error.code, '|', error.message)
    return { ok: false, error: '요청 등록에 실패했어요.' }
  }
  return { ok: true }
}

export async function getMyWorkRequests(userId: string): Promise<WorkRequest[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('work_requests').select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('[getMyWorkRequests]', error.message); return [] }
  return (data ?? []) as WorkRequest[]
}

/* ── 관리자 ── */

export async function getAllWorkRequests(status: string = 'all'): Promise<any[]> {
  const supabase = createClient()
  // profiles 로 가는 FK 가 두 개(user_id, reviewed_by)라 관계명을 명시해야 한다
  let q = supabase
    .from('work_requests')
    .select('*, profiles!work_requests_user_id_fkey ( nickname )')
    .order('created_at', { ascending: false })
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) { console.error('[getAllWorkRequests]', error.message); return [] }
  return (data ?? []).map((r: any) => ({ ...r, nickname: r.profiles?.nickname ?? null }))
}

export async function updateWorkRequest(
  id: string,
  patch: { status?: WorkRequestStatus; adminNote?: string; createdTagId?: string | null },
  reviewerId: string,
): Promise<boolean> {
  const supabase = createClient()
  const row: any = {}
  if (patch.status !== undefined) {
    row.status = patch.status
    row.reviewed_by = reviewerId
    row.reviewed_at = new Date().toISOString()
  }
  if (patch.adminNote !== undefined) row.admin_note = patch.adminNote
  if (patch.createdTagId !== undefined) row.created_tag_id = patch.createdTagId
  const { error } = await supabase.from('work_requests').update(row).eq('id', id)
  if (error) { console.error('[updateWorkRequest]', error.message); return false }
  return true
}
