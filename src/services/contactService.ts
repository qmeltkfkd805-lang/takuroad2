import { createClient } from '@/lib/supabase/client'

export type ContactPayload = {
  type: string
  title: string
  content: string
  extra: Record<string, string>
  email: string
  pageUrl?: string | null
  pageLabel?: string | null
}

export async function createContactMessage(payload: ContactPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('contact_messages')
    .insert({
      type: payload.type,
      title: payload.title,
      content: payload.content,
      extra: payload.extra ?? {},
      email: payload.email,
      user_id: user?.id ?? null,
      page_url: payload.pageUrl ?? null,
      page_label: payload.pageLabel ?? null,
    } as any)
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: (data as any)?.id }
}
export async function getMyContactMessages(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, type, title, content, status, created_at, answered_at, answer')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}
// ── 관리자: 전체 문의 조회 (status 필터) ──
export async function getAllContactMessages(status?: string) {
  const supabase = createClient()
  let q = supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
  if (status && status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return []
  return data ?? []
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