import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/* ============================================================
   이벤트 제보 승인 — 관리자 전용

   왜 서버로 옮기나
     지금은 브라우저(eventSubmissionService.approveSubmission)가
     Event 생성 → 제보 마감 → 제보자에게 EXP 지급을 한다.
     마지막 단계가 "관리자 세션이 남에게 grant_exp 를 부르는" 모양이라,
     grant_exp 의 관리자 예외에 기대고 있었다. 그 창구를 닫는다.

   보상 대상과 금액을 클라이언트가 정하지 못한다
     · 요청은 submissionId 와 검수자가 수정한 이벤트 값만 받는다
     · 제보자(submitted_by)와 상태는 DB 에서 다시 읽는다
     · EXP 금액은 record_activity_reward 안에서만 정해진다

   재시도 안전성
     Event 생성 / 제보 마감 / 보상이 REST 3회라 한 트랜잭션이 아니다.
     그래서 이미 승인된 제보로 다시 호출하면 Event 를 새로 만들지 않고
     보상 단계만 다시 시도한다. 보상 자체도
     uq_activity_logs_source(user, 'event_submit', submissionId) 로 멱등이라
     몇 번을 눌러도 EXP 는 한 번이다.
   ============================================================ */

interface ApproveBody {
  submissionId?: unknown
  tagId?: unknown
  shopId?: unknown
  title?: unknown
  type?: unknown
  startDate?: unknown
  endDate?: unknown
}

const EVENT_TYPES = new Set(['popup', 'collab_cafe', 'exhibition', 'official_event'])

export async function POST(req: NextRequest) {
  // 1) 관리자 확인 — 서버에서
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const { data: profile } = await userSupabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  let body: ApproveBody
  try { body = await req.json() } catch { return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 }) }

  const submissionId = typeof body.submissionId === 'string' ? body.submissionId : null
  if (!submissionId) return NextResponse.json({ error: 'submissionId 가 필요해요' }, { status: 400 })

  const svc = serviceClient()

  // 2) 제보를 DB 에서 다시 읽는다 — 제보자와 상태는 요청값을 믿지 않는다
  const { data: sub, error: subReadErr } = await svc
    .from('event_submissions')
    .select('id, submitted_by, status, event_id, tag_id, type, title')
    .eq('id', submissionId)
    .maybeSingle()

  if (subReadErr || !sub) {
    return NextResponse.json({ error: '제보를 찾을 수 없어요' }, { status: 404 })
  }
  if (sub.status === 'rejected') {
    return NextResponse.json({ error: '이미 반려된 제보예요' }, { status: 409 })
  }

  let eventId: string | null = sub.event_id ?? null

  // 3) 아직 승인 전이면 Event 생성 + 제보 마감
  if (!(sub.status === 'approved' && eventId)) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const type = typeof body.type === 'string' && EVENT_TYPES.has(body.type) ? body.type : null
    const shopId = typeof body.shopId === 'string' ? body.shopId : null
    const tagId = typeof body.tagId === 'string' ? body.tagId : null
    if (!title || !type || !shopId) {
      return NextResponse.json({ error: '이벤트 제목·유형·샵이 필요해요' }, { status: 400 })
    }

    const { data: event, error: eventErr } = await svc
      .from('events')
      .insert({
        tag_id: tagId,
        type,
        shop_id: shopId,
        title,
        start_date: typeof body.startDate === 'string' ? body.startDate : null,
        end_date: typeof body.endDate === 'string' ? body.endDate : null,
      })
      .select('id')
      .single()

    if (eventErr || !event) {
      console.error('[approve-submission] Event 생성 실패', eventErr?.code, eventErr?.message)
      return NextResponse.json({ error: '이벤트 생성에 실패했어요' }, { status: 500 })
    }
    eventId = event.id

    const { error: subErr } = await svc
      .from('event_submissions')
      .update({
        status: 'approved',
        event_id: eventId,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId)

    if (subErr) {
      // Event 는 만들어졌는데 제보 마감이 실패했다. 상태를 숨기지 않는다.
      console.error('[approve-submission] 제보 마감 실패', subErr.code, subErr.message)
      return NextResponse.json(
        { error: '이벤트는 만들어졌지만 제보 마감에 실패했어요. 다시 시도해주세요', eventId },
        { status: 500 },
      )
    }
  }

  // 4) 제보자에게 보상 — 대상·금액은 RPC 가 정한다. 여러 번 호출해도 한 번만 지급된다.
  let rewarded = false
  let rewardError: string | null = null
  if (sub.submitted_by) {
    const { data, error } = await svc.rpc('record_activity_reward', {
      p_user: sub.submitted_by,
      p_type: 'event_submit',
      p_source_id: submissionId,
      p_snapshot: {
        event_name: typeof body.title === 'string' ? body.title.trim() : (sub.title ?? '이벤트'),
        event_type: typeof body.type === 'string' ? body.type : (sub.type ?? undefined),
      },
      p_title: null,
      p_work_id: typeof body.tagId === 'string' ? body.tagId : (sub.tag_id ?? null),
    })
    if (error) {
      rewardError = error.message
      console.error('[approve-submission] 보상 실패', { submissionId, code: error.code, message: error.message })
    } else {
      const row = (Array.isArray(data) ? data[0] : data) as { rewarded?: boolean } | null
      rewarded = !!row?.rewarded
    }
  }

  return NextResponse.json({
    success: true,
    eventId,
    rewarded,
    // 승인은 됐는데 보상만 실패한 상태를 관리자에게 숨기지 않는다.
    // 같은 제보로 다시 승인을 눌러도 이벤트는 새로 안 만들어지고 보상만 재시도된다.
    rewardFailed: rewardError !== null,
  })
}
