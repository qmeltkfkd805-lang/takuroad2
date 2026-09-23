import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ============================================================
   문의 첨부 자리 예약 — 로그인 사용자 전용

   왜 서버가 승인하나
     contact-files 의 INSERT 정책이 {public} 에 조건이 버킷 이름뿐이라
     비로그인 상태에서 anon 키만으로 아무 파일이나 올릴 수 있었다.
     크기·형식 제한도 없고, DELETE 정책이 없어 지울 수도 없었다.

   파일 바이트는 여기를 지나지 않는다
     서버는 자리만 예약하고 서명 업로드 URL 을 발급한다. 브라우저가 그 URL 로
     직접 보낸다. 배포 환경의 요청 본문 한도(Vercel 4.5 MB)에 걸리지 않고,
     10 MiB 제한은 버킷이 강제한다.

   클라이언트가 고를 수 없는 것
     · 경로       RPC 가 {userId}/{draftId}/{slot}-{rand}.{ext} 로 만든다
     · 슬롯       초안의 reserved_count 에서 나온다
     · 개수       초안당 누적 5개를 DB 가 강제한다
     확장자만 제안할 수 있고 그것도 ^[a-z0-9]{1,8}$ 로 검증한다.

   size 는 사전 검사값이다
     클라이언트가 신고한 값이라 신뢰하지 않는다. 실제 크기는 제출 시
     /api/contact 가 Storage 에서 다시 읽는다.
   ============================================================ */

const MAX_BYTES = 10 * 1024 * 1024   // 10 MiB. 버킷·RPC 와 같은 값

/** RPC 가 올린 SQLSTATE 를 HTTP 로 옮긴다 */
function statusOf(code: string | undefined): number {
  if (code === '42501') return 403
  if (code === 'P0002') return 404
  if (code === '22023') return 400
  if (code === '23514') return 400   // check 제약 (누적 5개)
  return 500
}

interface Body {
  draftId?: unknown
  ext?: unknown
  size?: unknown
}

export async function POST(req: NextRequest) {
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  let body: Body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const draftIdIn = typeof body.draftId === 'string' && body.draftId ? body.draftId : null
  const ext = typeof body.ext === 'string' ? body.ext.slice(0, 8) : ''
  const size = typeof body.size === 'number' && Number.isFinite(body.size) ? Math.floor(body.size) : null

  if (size !== null && size < 0) {
    return NextResponse.json({ error: '파일 크기가 올바르지 않아요' }, { status: 400 })
  }
  // 사전 검사. RPC 도 같은 값으로 한 번 더 본다
  if (size !== null && size > MAX_BYTES) {
    return NextResponse.json(
      { error: '파일은 10 MB까지 올릴 수 있어요', code: 'TOO_LARGE' },
      { status: 400 },
    )
  }

  const svc = serviceClient()

  try {
    // 초안 — 주어지지 않으면 연다. 살아 있는 초안이 있으면 RPC 가 그것을 돌려준다
    let draftId = draftIdIn
    let expiresAt: string | null = null
    if (!draftId) {
      const { data, error } = await svc.rpc('contact_open_draft', { p_user: user.id })
      if (error) throw Object.assign(new Error(error.message), { code: error.code })
      const row = (Array.isArray(data) ? data[0] : data) as
        { draft_id: string; remaining: number; expires_at: string } | null
      if (!row) throw new Error('초안을 열지 못했어요')
      draftId = row.draft_id
      expiresAt = row.expires_at
    }

    const { data: resData, error: resErr } = await svc.rpc('contact_reserve_attachment', {
      p_user: user.id,
      p_draft: draftId,
      p_ext: ext,
      p_declared_size: size,
    })
    if (resErr) throw Object.assign(new Error(resErr.message), { code: resErr.code })

    const slot = (Array.isArray(resData) ? resData[0] : resData) as {
      attachment_id: string; bucket_id: string; object_path: string
      slot_index: number; remaining: number
    } | null
    if (!slot) throw new Error('첨부 자리를 예약하지 못했어요')

    /* 서명 업로드 URL. 2시간 유효하고 조정할 수 없다.
       발급이 실패하면 예약 슬롯은 이미 소모된 상태다 — reserved_count 는
       줄지 않는다. 사용자에게는 남은 개수가 하나 줄어든 것으로 보인다.
       그 객체는 업로드되지 않은 채 만료를 거쳐 정리된다. */
    const { data: signed, error: signErr } = await svc.storage
      .from(slot.bucket_id)
      .createSignedUploadUrl(slot.object_path)

    if (signErr || !signed) {
      console.error('[contact/attachments] 서명 URL 실패', signErr?.message)
      return NextResponse.json(
        { error: '업로드 준비에 실패했어요. 다시 시도해주세요', draftId },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      draftId,
      draftExpiresAt: expiresAt,
      attachmentId: slot.attachment_id,
      bucket: slot.bucket_id,
      path: slot.object_path,
      // 브라우저는 uploadToSignedUrl(path, token, file) 로 보낸다
      token: signed.token,
      signedUrl: signed.signedUrl,
      slot: slot.slot_index,
      remaining: slot.remaining,
      maxBytes: MAX_BYTES,
    })
  } catch (e) {
    const code = (e as { code?: string }).code
    const message = e instanceof Error ? e.message : '알 수 없는 오류'
    const status = statusOf(code)
    // 경로·토큰은 로그에 남기지 않는다
    if (status >= 500) console.error('[contact/attachments]', code, message)
    return NextResponse.json({ error: message, code }, { status })
  }
}
