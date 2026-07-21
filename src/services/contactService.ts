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