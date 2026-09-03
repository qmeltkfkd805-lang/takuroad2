import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

/* 게시글 신고 처리 전용 — 반려 / 숨김 / 다시 공개.
   (services/communityPostService.ts 의 resolvePostReports 가 유일한 호출부)

   왜 서버로 옮겼나 — 예전에는 클라이언트가 community_posts 를 직접 UPDATE 했고
   (hidePost / restorePost / deletePost), 신고 자체에는 처리 상태가 아예 없었다.
     1) 글 상태 변경과 신고 처리가 별개 요청이면 "글은 숨겨졌는데 신고는 미처리"가 생긴다.
        두 UPDATE 를 하나의 DB 함수 안에서 처리한다 — plpgsql 본문은 단일 트랜잭션이라
        중간에 실패하면 전부 롤백된다.
     2) 어떤 신고를 처리할지 클라이언트가 정하면 안 된다. postId 만 받고,
        "그 글의 pending 신고 전부"를 서버가 고른다.
     3) reviewed_by 는 세션에서 확인한 관리자 id 다. 본문에서 받지 않는다.

   여기서 지키는 것:
   - 본문은 postId, action 만 신뢰한다. report id 목록·reviewer·시각은 받지 않는다.
   - 사용자 클라이언트로 admin 을 확인한 뒤 service_role 로 RPC 를 부른다.
     service_role 은 JWT 가 없어 함수 안에서 auth.uid() 가 null 이므로,
     p_admin_id 를 넘겨 RPC 가 다시 검증한다 — 이 라우트가 잘못돼도 거기서 걸린다.
   - 삭제 경로는 만들지 않는다. 신고 화면에서 글을 지우는 동작은 없앴다. */

type Action = 'dismiss' | 'hide_and_resolve' | 'restore'
const ACTIONS: Action[] = ['dismiss', 'hide_and_resolve', 'restore']

export async function POST(request: NextRequest) {
  // 1) 요청자가 로그인 + admin 인지 확인 (사용자 클라이언트로, RLS 그대로 적용)
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const { data: profile } = await userSupabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const postId = typeof body?.postId === 'string' ? body.postId.trim() : ''
  const action = body?.action as Action | undefined

  if (!postId) return NextResponse.json({ error: '게시글 번호가 없어요' }, { status: 400 })
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: '알 수 없는 동작이에요' }, { status: 400 })
  }

  // 2) admin 확인됐으면 Service Role 로 실제 처리 (RLS 우회)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminSupabase.rpc('admin_resolve_post_reports', {
    p_post_id: postId,
    p_action: action,
    p_admin_id: user.id,
  })

  if (error) {
    // RPC 가 errcode 로 구분해서 던진다. 그대로 상태 코드에 옮긴다.
    const code = (error as { code?: string }).code
    const status = code === '42501' ? 403 : code === 'P0002' ? 404 : code === '22023' ? 400 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  // { ok, action, reports, post_status } — reports 는 이번에 처리된 신고 건수
  return NextResponse.json({ success: true, ...(data as Record<string, unknown> ?? {}) })
}
