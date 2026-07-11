import { createClient } from '@/lib/supabase/client'
import { recordEventSubmitActivity } from '@/services/activityService'

export interface NewSubmission {
  tagId: string
  type: string
  title: string
  placeSnapshot: any
  shopId: string | null      // 샵 상세에서 진입 시 이미 알고 있는 샵 (작품 홈 진입은 null)
  placeDetail: string | null
  startDate: string | null
  endDate: string | null
  sourceUrl: string
  description: string | null
}

export async function createEventSubmission(s: NewSubmission, userId: string): Promise<boolean> {
  const supabase = createClient()

  // 검수 없이 바로 등록: shop_id가 있으면 events를 즉시 생성
  let eventId: string | null = null
  if (s.shopId) {
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .insert({
        tag_id: s.tagId,
        type: s.type,
        shop_id: s.shopId,
        title: s.title,
        start_date: s.startDate,
        end_date: s.endDate,
      } as any)
      .select('id')
      .single()
    if (evErr) console.error('[이벤트 즉시 생성 실패 - 제보만 저장됨]', evErr.message, evErr.code)
    else eventId = ev?.id ?? null
  }

  const { error } = await supabase.from('event_submissions').insert({
    tag_id: s.tagId,
    type: s.type,
    title: s.title,
    place_snapshot: s.placeSnapshot,
    shop_id: s.shopId,
    place_detail: s.placeDetail,
    start_date: s.startDate,
    end_date: s.endDate,
    source_url: s.sourceUrl,
    description: s.description,
    submitted_by: userId,
    status: eventId ? 'approved' : 'pending',
    event_id: eventId,
    reviewed_at: eventId ? new Date().toISOString() : null,
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
  shopId: string | null     // 제보 시 이미 연결된 샵 (샵 상세 진입). null이면 검수 때 샵 마련
  shopName: string | null   // 위 shopId의 샵 이름 (표시용)
  shopSlug: string | null   // 위 shopId의 샵 slug (링크용)
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
    .select('id, tag_id, type, title, place_snapshot, shop_id, place_detail, start_date, end_date, source_url, description, created_at, submitted_by')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[검수 조회 실패]', error.message, error.code, error.details)
    return []
  }
  const rows = data ?? []
  if (rows.length === 0) return []

  // 작품 이름 + 제보자 이름 + (있으면) 연결된 샵을 따로 모아서 붙임 (조인 모호성 회피)
  const tagIds = [...new Set(rows.map((r: any) => r.tag_id).filter(Boolean))]
  const userIds = [...new Set(rows.map((r: any) => r.submitted_by).filter(Boolean))]
  const shopIds = [...new Set(rows.map((r: any) => r.shop_id).filter(Boolean))]

  const [{ data: tags }, { data: profiles }, { data: shops }] = await Promise.all([
    supabase.from('tags').select('id, name').in('id', tagIds),
    userIds.length
      ? supabase.from('profiles').select('id, nickname').in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
    shopIds.length
      ? supabase.from('shops').select('id, name, slug').in('id', shopIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const tagMap = new Map((tags ?? []).map((t: any) => [t.id, t.name]))
  const userMap = new Map((profiles ?? []).map((p: any) => [p.id, p.nickname]))
  const shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]))

  return rows.map((r: any) => ({
    id: r.id,
    tagId: r.tag_id,
    tagName: tagMap.get(r.tag_id) ?? '(작품 없음)',
    type: r.type,
    title: r.title,
    placeSnapshot: r.place_snapshot,
    shopId: r.shop_id ?? null,
    shopName: r.shop_id ? (shopMap.get(r.shop_id)?.name ?? null) : null,
    shopSlug: r.shop_id ? (shopMap.get(r.shop_id)?.slug ?? null) : null,
    placeDetail: r.place_detail,
    startDate: r.start_date,
    endDate: r.end_date,
    sourceUrl: r.source_url,
    description: r.description,
    submitterName: userMap.get(r.submitted_by) ?? '익명',
    createdAt: r.created_at,
  }))
}

export interface ApproveInput {
  submissionId: string
  tagId: string
  shopId: string          // 검수 화면에서 준비된 shop_id (전제)
  type: string
  title: string
  startDate: string | null
  endDate: string | null
}

// 제보 승인 = 준비된 shop_id로 Event 생성 + 제보 마감.
// (shop 준비는 검수 화면의 책임 — 이 함수는 shop_id가 있다고 전제)
export async function approveSubmission(input: ApproveInput, reviewerId: string): Promise<boolean> {
  const supabase = createClient()

  // ③ Event 생성 (검수자가 수정한 값으로)
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .insert({
      tag_id: input.tagId,
      type: input.type,
      shop_id: input.shopId,
      title: input.title,
      start_date: input.startDate,
      end_date: input.endDate,
    } as any)
    .select('id')
    .single()

  if (eventErr || !event) {
    console.error('[승인 실패 - Event 생성]', eventErr?.message, eventErr?.code)
    return false
  }

  // ④ 제보 마감
  const { error: subErr } = await supabase
    .from('event_submissions')
    .update({
      status: 'approved',
      event_id: event.id,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    } as any)
    .eq('id', input.submissionId)

  if (subErr) {
    console.error('[승인 실패 - 제보 마감]', subErr.message, subErr.code)
    return false
  }

  // 성장 Activity — 제보 채택.
  // ⭐ 성취는 검수자(reviewerId)가 아니라 '제보한 사람'의 것이다
  try {
    const { data: sub } = await supabase
      .from('event_submissions').select('submitted_by').eq('id', input.submissionId).maybeSingle()
    const submitter = (sub as any)?.submitted_by
    if (submitter) {
      await recordEventSubmitActivity({
        userId: submitter,
        eventId: event.id,
        eventName: input.title,
        eventType: input.type as any,
        workId: input.tagId ?? null,
      })
    }
  } catch (e) {
    console.error('[제보 채택 Activity 실패]', e)
  }

  return true
}

// 제보 반려 = Event 생성 없이 제보만 마감(사유 기록, 사유는 선택).
export async function rejectSubmission(
  submissionId: string,
  reason: string | null,
  reviewerId: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('event_submissions')
    .update({
      status: 'rejected',
      reject_reason: reason,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    } as any)
    .eq('id', submissionId)

  if (error) {
    console.error('[반려 실패]', error.message, error.code)
    return false
  }
  return true
}