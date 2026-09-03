import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

/* 사장님 인증 심사 전용 — 승인/거절.
   (services/shopService.ts 의 approveVerifyRequest / rejectVerifyRequest 가 유일한 호출부)

   왜 서버로 옮겼나 — 예전에는 클라이언트가 shops 를 직접 UPDATE 했다:
     update shop_verify_requests set status='approved'   ← 먼저
     update shops set is_claimed=true, owner_id=<클라가 넘긴 userId>
   문제가 셋이었다.
     1) 두 UPDATE 가 독립이라 뒤엣것이 실패하면 "승인됐는데 소유권은 안 넘어간" 상태로
        조용히 끝났다.
     2) shopId·userId 를 클라이언트가 넘겼고, 요청 레코드와 대조하지 않았다.
     3) 중복 승인·이미 다른 사장님이 있는 샵에 대한 가드가 없었다.
   그리고 곧 shops 의 is_claimed·owner_id 컬럼 UPDATE 권한을 authenticated 에서
   회수할 예정이라, 클라이언트에서는 애초에 쓸 수 없게 된다.

   여기서 지키는 것:
   - 본문은 requestId 만 신뢰한다. shop_id·user_id 는 요청 레코드에서 읽는다.
   - status 가 'pending' 이 아니면 409. (중복 승인 차단)
   - 이미 다른 사람이 사장님인 샵이면 409.
   - 순서를 뒤집어 shops 를 먼저 고친다. 두 번째가 실패하면 요청이 pending 으로
     남아 관리자가 다시 누르면 되고, 재실행은 멱등하다. 반대 순서로는
     "승인 표시만 남고 소유권 없음" 이 생긴다 — 그쪽이 훨씬 나쁘다.
   - is_verified 는 건드리지 않는다. 공식 샵 지정은 별개 축이다. */

type Action = 'approve' | 'reject'

export async function POST(request: NextRequest) {
  // 1) 요청자가 로그인 + admin 인지 확인 (사용자 클라이언트로, RLS 그대로 적용)
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const { data: profile } = await userSupabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''
  const action = body?.action as Action | undefined
  const rawReason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const reason = rawReason === '' ? null : rawReason.slice(0, 1000)

  if (!requestId) return NextResponse.json({ error: '요청 번호가 없어요' }, { status: 400 })
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: '알 수 없는 동작이에요' }, { status: 400 })
  }

  // 2) admin 확인됐으면 Service Role 로 실제 처리 (RLS 우회)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 요청 레코드가 진실의 원천이다. 클라이언트가 보낸 shop_id·user_id 는 쓰지 않는다.
  const { data: req, error: reqReadError } = await adminSupabase
    .from('shop_verify_requests')
    .select('id, shop_id, user_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (reqReadError) return NextResponse.json({ error: reqReadError.message }, { status: 500 })
  if (!req) return NextResponse.json({ error: '인증 요청을 찾을 수 없어요' }, { status: 404 })
  if (req.status !== 'pending') {
    // 이미 다른 관리자가 처리했거나 더블클릭. 덮어쓰지 않고 알린다.
    return NextResponse.json(
      { error: `이미 처리된 요청이에요 (현재 상태: ${req.status})` },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()

  if (action === 'reject') {
    /* 거절 사유는 reject_reason 에 넣는다. note 는 신청자가 낸 사업자 메모라
       건드리지 않는다 — 예전에는 사유로 덮어써서, 어떤 rejected 행의 note 가
       진짜 사유인지 구분할 수 없게 됐다(그래서 화면에서 '거절 사유'라고 못 썼다). */
    const patch: Record<string, unknown> = {
      status: 'rejected',
      reviewed_by: user.id,
      reject_reason: reason,   // 사유를 안 적었으면 null
      updated_at: now,
    }

    const { data: updated, error } = await adminSupabase
      .from('shop_verify_requests')
      .update(patch)
      .eq('id', requestId)
      .eq('status', 'pending')      // 경합 시 한 번만 통과
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!updated?.length) {
      return NextResponse.json({ error: '이미 처리된 요청이에요' }, { status: 409 })
    }
    return NextResponse.json({ success: true })
  }

  // ── 승인 ──────────────────────────────────────────────────
  const { data: shop, error: shopReadError } = await adminSupabase
    .from('shops')
    .select('id, name, is_claimed, owner_id')
    .eq('id', req.shop_id)
    .maybeSingle()

  if (shopReadError) return NextResponse.json({ error: shopReadError.message }, { status: 500 })
  if (!shop) return NextResponse.json({ error: '대상 샵을 찾을 수 없어요' }, { status: 404 })

  // 이미 다른 사람이 사장님인 샵은 덮어쓰지 않는다. 사람이 판단할 문제다.
  if (shop.is_claimed && shop.owner_id && shop.owner_id !== req.user_id) {
    return NextResponse.json(
      { error: '이 샵은 이미 다른 분이 사장님으로 인증돼 있어요. 먼저 기존 인증을 정리해주세요.' },
      { status: 409 }
    )
  }

  // 샵 먼저. 여기서 실패하면 요청은 pending 그대로라 다시 누르면 된다.
  const { error: shopError } = await adminSupabase
    .from('shops')
    .update({ is_claimed: true, owner_id: req.user_id })
    .eq('id', req.shop_id)

  if (shopError) return NextResponse.json({ error: shopError.message }, { status: 500 })

  // 요청 상태 갱신. 그 사이 다른 관리자가 먼저 처리했다면 0건이 되는데,
  // 소유권 결과는 같으므로 성공으로 본다(멱등).
  const { error: reqError } = await adminSupabase
    .from('shop_verify_requests')
    .update({ status: 'approved', reviewed_by: user.id, updated_at: now })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (reqError) {
    // 소유권은 넘어갔지만 요청 상태만 못 바꾼 상태. 다시 누르면 같은 결과로 수렴한다.
    return NextResponse.json(
      { error: '소유권은 넘겼는데 요청 상태 갱신에 실패했어요. 한 번 더 눌러주세요.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
