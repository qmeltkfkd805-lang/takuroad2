import { createClient } from '@/lib/supabase/client'

export interface Notice {
  id: string
  title: string
  content: string
  image_url: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export async function getNotices(): Promise<Notice[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('notices')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as Notice[]
}

export async function getNoticeById(id: string): Promise<Notice | null> {
  const supabase = createClient()
  const { data } = await supabase.from('notices').select('*').eq('id', id).maybeSingle()
  return (data ?? null) as Notice | null
}

export async function createNotice(params: {
  title: string
  content: string
  imageUrl?: string | null
  isPinned?: boolean
  userId: string
}): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('notices').insert({
    title: params.title,
    content: params.content,
    image_url: params.imageUrl ?? null,
    is_pinned: params.isPinned ?? false,
    created_by: params.userId,
  } as any)
  if (error) console.error('createNotice:', JSON.stringify(error))
  return !error
}

export async function updateNotice(id: string, fields: Record<string, any>): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notices')
    .update({ ...fields, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
  if (error) console.error('updateNotice:', JSON.stringify(error))
  return !error
}

export async function deleteNotice(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('notices').delete().eq('id', id)
  return !error
}

export async function uploadNoticeImage(file: File): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = 'notices/' + Date.now() + '.' + ext
  const { error } = await supabase.storage.from('shop-images').upload(path, file, { contentType: file.type })
  if (error) { console.error('uploadNoticeImage:', JSON.stringify(error)); return null }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}