import { createClient } from '@/lib/supabase/client'

export type ContactPayload = {
  type: string
  title: string
  content: string
  extra: Record<string, string>
  email: string
  pageUrl?: string | null
  pageLabel?: string | null
  attachmentUrls?: string[]
}

export async function createContactMessage(payload: ContactPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  /* 문의는 로그인한 사용자만 받는다.
     비로그인 문의는 답변을 전달할 경로가 없었다 — 메일 발송 기능이 없고
     '내 문의'(getMyContactMessages)는 user_id 로 조회하므로 열 수도 없다.
     폼(ContactForm/PartnerForm)에서 이미 막지만, 서비스에서도 한 번 더 막는다.
     DB 쪽도 contact_insert_any 정책이 user_id = auth.uid() 를 요구한다. */
  if (!user) return { ok: false, error: '로그인이 필요해요' }

  /* 접수번호(id)를 클라이언트에서 미리 만든다.
     예전에는 .select('id').single() 로 돌려받았는데, INSERT ... RETURNING 은
     SELECT 정책의 적용을 받는다. contact_select_own 이 auth.uid() = user_id 라
     비로그인 문의는 양쪽이 null 이고 null = null 은 참이 아니다 — 방금 넣은
     자기 행을 못 읽어서 42501 "new row violates row-level security policy" 로
     접수가 통째로 실패했다. 비로그인 문의가 한 번도 접수된 적이 없었던 이유다.

     성공 화면이 접수번호(#앞 8자리)를 보여주므로 RETURNING 을 그냥 없앨 수는 없다.
     id 를 미리 정해 넣고 그 값을 그대로 돌려준다.
     (contact_messages_returning_fix.sql 에서 id 의 INSERT 권한을 부여한다) */
  const id = crypto.randomUUID()

  const { error } = await supabase
    .from('contact_messages')
    .insert({
      id,
      type: payload.type,
      title: payload.title,
      content: payload.content,
      extra: payload.extra ?? {},
      email: payload.email,
      user_id: user.id,
      page_url: payload.pageUrl ?? null,
      page_label: payload.pageLabel ?? null,
      attachment_urls: payload.attachmentUrls ?? [],
    } as any)

  if (error) return { ok: false, error: error.message }
  return { ok: true, id }
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
// ── 첨부파일 업로드 → 공개 URL 배열 ──
export async function uploadContactFiles(files: File[]): Promise<string[]> {
  if (!files.length) return []
  const supabase = createClient()
  const urls: string[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop() || 'bin'
    const path = `contact/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await supabase.storage.from('contact-files').upload(path, file)
    if (error) { console.error('[첨부 업로드 실패]', error.message); continue }
    const { data } = supabase.storage.from('contact-files').getPublicUrl(path)
    if (data?.publicUrl) urls.push(data.publicUrl)
  }
  return urls
}