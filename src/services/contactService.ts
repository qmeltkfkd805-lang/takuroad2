import { createClient } from '@/lib/supabase/client'
import { prepareImage } from '@/lib/storage/compressImage'

/* ── 첨부 업로드 ─────────────────────────────────────────────
   서버가 자리를 예약하고 서명 URL 을 주면 브라우저가 그 URL 로 직접 보낸다.

   예전에는 브라우저가 contact-files 에 직접 upload() 했다. 버킷의 INSERT
   정책이 {public} 에 조건이 버킷 이름뿐이라 비로그인도 아무 파일이나 올릴 수
   있었고, 경로도 클라이언트가 정했다. 이제 경로·슬롯·개수를 서버가 정한다.

   압축을 예약보다 먼저 한다
     서버가 예약 시점에 확장자를 경로에 박기 때문에, 압축 후 webp 가 되면
     경로와 어긋난다. 압축한 결과의 확장자·크기로 예약해야 맞는다.

   초안(draftId)을 제출까지 들고 간다
     첨부가 그 초안에 묶여 있고, 제출 때 서버가 그 초안의 첨부만 확인해
     연결한다. 초안은 1시간 뒤 만료되므로 화면에서 안내해야 한다. */

export const CONTACT_MAX_FILES = 5
export const CONTACT_MAX_BYTES = 10 * 1024 * 1024   // 10 MiB. 버킷·RPC 와 같은 값

export interface AttachmentUploadResult {
  /** 제출 시 함께 보내야 한다. 하나도 못 올렸으면 null */
  draftId: string | null
  uploaded: number
  /** 올리지 못한 파일. 사용자에게 보여줘야 한다 */
  failed: { name: string; reason: string }[]
  /** 초안 만료 시각. 화면 안내용 */
  expiresAt: string | null
}

/* 응답에 타입을 준다. any 로 두면 draftId 의 제어 흐름 추론이
   res → data → draftId → res 로 순환해 TS7022 가 난다. */
interface ReserveResponse {
  draftId?: string
  draftExpiresAt?: string
  bucket?: string
  path?: string
  token?: string
  error?: string
}

interface SubmitResponse {
  id?: string
  attached?: number
  dropped?: number
  error?: string
}

function extOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name)
  return m ? m[1].toLowerCase() : ''
}

export async function uploadContactFiles(files: File[]): Promise<AttachmentUploadResult> {
  const out: AttachmentUploadResult = { draftId: null, uploaded: 0, failed: [], expiresAt: null }
  if (!files.length) return out

  const supabase = createClient()
  let draftId: string | null = null

  for (const file of files.slice(0, CONTACT_MAX_FILES)) {
    try {
      /* 이미지면 압축한다. prepareImage 는 PDF 등 비이미지와 GIF 를 그대로
         통과시키므로 문서 첨부는 원본이 유지된다. */
      const prep = await prepareImage(file)
      const blob = prep.data
      const ext = prep.compressed ? prep.ext : extOf(file.name)

      // 사전 검사는 압축 결과 기준이다. 서버도 같은 값으로 다시 본다
      if (blob.size > CONTACT_MAX_BYTES) {
        out.failed.push({ name: file.name, reason: '10MB를 넘어요' })
        continue
      }

      // 1) 서버에 자리 예약 — 경로·슬롯·개수는 서버가 정한다
      const res = await fetch('/api/contact/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, ext, size: blob.size }),
      })
      const data = (await res.json()) as ReserveResponse
      if (!res.ok) {
        out.failed.push({ name: file.name, reason: data?.error ?? '첨부 준비에 실패했어요' })
        /* 초안 만료나 개수 초과면 남은 파일도 같은 이유로 실패한다.
           의미 없는 요청을 반복하지 않는다. */
        if (res.status === 400 || res.status === 403) break
        continue
      }

      draftId = data.draftId ?? null
      out.draftId = draftId
      if (data.draftExpiresAt) out.expiresAt = data.draftExpiresAt

      // 2) 서명 URL 로 직접 전송. 파일 바이트는 우리 서버를 지나지 않는다
      if (!data.bucket || !data.path || !data.token) {
        out.failed.push({ name: file.name, reason: '업로드 준비 응답이 올바르지 않아요' })
        continue
      }
      const { error } = await supabase.storage
        .from(data.bucket)
        .uploadToSignedUrl(data.path, data.token, blob, { contentType: prep.contentType })

      if (error) {
        /* 예약 슬롯은 이미 소모됐다 — 남은 개수가 하나 줄어든 채로 남는다.
           그 객체는 업로드되지 않은 채 만료를 거쳐 정리된다. */
        out.failed.push({ name: file.name, reason: error.message })
        continue
      }
      out.uploaded++
    } catch (e) {
      out.failed.push({ name: file.name, reason: e instanceof Error ? e.message : '업로드에 실패했어요' })
    }
  }

  return out
}

/* ── 문의 접수 ───────────────────────────────────────────────
   attachment_urls 를 보내지 않는다. 서버가 초안의 첨부를 Storage 에서 확인해
   직접 만든다. 클라이언트가 임의의 URL 을 문의에 붙일 수 없다.

   접수번호(id)도 서버가 만든다. 예전에는 INSERT ... RETURNING 이 SELECT 정책에
   걸려 실패하는 문제 때문에 클라이언트가 id 를 미리 만들었는데, 이제 서버가
   service_role 로 넣고 그 id 를 돌려주므로 그 우회가 필요 없다. */
export type ContactPayload = {
  type: string
  title: string
  content: string
  extra: Record<string, unknown>
  email: string
  pageUrl?: string | null
  pageLabel?: string | null
  /** uploadContactFiles 가 돌려준 값 */
  draftId?: string | null
}

export interface ContactSubmitResult {
  ok: boolean
  id?: string
  /** 실제로 붙은 첨부 수 */
  attached?: number
  /** 업로드가 끝나지 않아 빠진 첨부 수. 0 이 아니면 알려야 한다 */
  dropped?: number
  error?: string
  /** 초안 만료 등으로 첨부부터 다시 올려야 하는 경우 */
  needsReattach?: boolean
}

export async function createContactMessage(payload: ContactPayload): Promise<ContactSubmitResult> {
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: payload.draftId ?? null,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        extra: payload.extra ?? {},
        email: payload.email,
        pageUrl: payload.pageUrl ?? null,
        pageLabel: payload.pageLabel ?? null,
      }),
    })
    const data = (await res.json()) as SubmitResponse
    if (!res.ok) {
      const msg = String(data?.error ?? '접수에 실패했어요')
      return { ok: false, error: msg, needsReattach: msg.includes('만료') }
    }
    return { ok: true, id: data.id, attached: data.attached, dropped: data.dropped }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '접수에 실패했어요' }
  }
}

export async function getMyContactMessages(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, type, title, content, status, created_at, answered_at, answer, attachment_urls')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

/* ── 관리자: 문의 조회 ─────────────────────────────────────────────
   security definer RPC 를 거친다. 예전에는 select('*') 로 테이블을 직접 읽었는데,
   그러면 admin_note(내부 메모)의 SELECT 권한을 authenticated 에서 회수할 수 없다 —
   회수하면 관리자 화면도 같이 막힌다. RPC 는 소유자 권한으로 돌아서
   컬럼 권한과 무관하게 읽는다. 회원 관리 화면(get_admin_members 등)과 같은 구조다.

   type 필터는 서버에서 건다. 예전에는 전부 받아온 뒤 JS 에서 걸러서,
   문의 관리 탭이 제휴 문의 행까지 받아 버렸다.
   status 필터와 검색은 화면에서 한다 — 탭 전환에 재조회가 없어야 한다. */
export interface ContactMessage {
  id: string
  type: string
  title: string | null
  content: string | null
  extra: Record<string, unknown> | null
  email: string | null
  user_id: string | null
  page_url: string | null
  page_label: string | null
  attachment_urls: string[] | null
  status: string
  answer: string | null
  answered_at: string | null
  answered_by: string | null
  admin_note: string | null
  created_at: string
  updated_at: string | null
}

export async function getAdminContactMessages(opts: {
  onlyType?: string
  excludeType?: string
} = {}): Promise<ContactMessage[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_admin_contact_messages', {
    p_only_type: opts.onlyType ?? null,
    p_exclude_type: opts.excludeType ?? null,
  })
  // 조회 실패와 "문의 0건"은 다른 상태다. 빈 배열로 뭉개지 않는다
  if (error) throw error
  return (data ?? []) as ContactMessage[]
}

// ── 관리자: 상태·메모 갱신 ──
export async function updateContactMessage(
  id: string,
  patch: { status?: string; adminNote?: string; answer?: string }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const upd: any = {}
  if (patch.status !== undefined) {
    upd.status = patch.status
    if (patch.status === 'done') { upd.answered_at = new Date().toISOString(); upd.answered_by = user?.id ?? null }
  }
  if (patch.adminNote !== undefined) upd.admin_note = patch.adminNote
  if (patch.answer !== undefined) upd.answer = patch.answer
  const { error } = await supabase.from('contact_messages').update(upd).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
