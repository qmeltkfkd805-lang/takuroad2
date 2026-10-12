import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/* ============================================================
   회원 탈퇴 (2026-10-12) — migrations/account_delete.sql

   1) delete_account_data(uid)  개인 기록 삭제 + 프로필을 '탈퇴한회원_…' 껍데기로 (한 트랜잭션)
   2) auth.admin.deleteUser     로그인 계정 삭제 → 다시 로그인 불가, 같은 소셜 계정으로 재가입하면 새 회원
      (팔로우·차단·저장·이벤트 참여 등 auth.users 를 가리키는 개인 기록은 여기서 CASCADE 로 지워진다)

   글·댓글·후기·루트는 profiles 껍데기를 가리키므로 '탈퇴한 회원'으로 남는다.
   1) 은 몇 번 불러도 같은 결과(멱등)라, 2) 가 실패하면 다시 누르면 된다.
   누구를 지울지는 세션에서만 정한다 — 요청 본문의 id 는 받지 않는다.
   ============================================================ */

const CONFIRM_PHRASE = '탈퇴합니다'

export async function POST(req: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  let body: { phrase?: unknown }
  try { body = await req.json() } catch { body = {} }
  if (body.phrase !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: '확인 문구가 맞지 않아요' }, { status: 400 })
  }

  const svc = serviceClient()

  const { data: prof } = await svc.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (prof?.role === 'admin') {
    return NextResponse.json({ error: '관리자 계정은 탈퇴할 수 없어요. 다른 관리자에게 권한을 넘긴 뒤 진행해 주세요.' }, { status: 403 })
  }

  // 1) 개인 기록 삭제 + 익명화
  const { error: dataErr } = await svc.rpc('delete_account_data', { p_uid: user.id })
  if (dataErr) {
    console.error('[account-delete] 데이터 정리 실패', { code: dataErr.code, message: dataErr.message, details: dataErr.details, hint: dataErr.hint })
    return NextResponse.json({ error: '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  // 2) 로그인 계정 삭제
  const { error: authErr } = await svc.auth.admin.deleteUser(user.id)
  if (authErr) {
    console.error('[account-delete] 계정 삭제 실패', { status: authErr.status, message: authErr.message })
    return NextResponse.json({ error: '탈퇴 처리를 마치지 못했어요. 다시 한 번 눌러 주세요.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
