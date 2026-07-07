import { createClient } from '@/lib/supabase/client'
export { uploadWorkImage } from '@/services/workAdminService'

export interface NewWork {
  name: string
  slug?: string
  english_name?: string
  ip_type: string
  original_type?: string
  status?: string
  cover_url?: string | null
  banner_image?: string | null
  accent_color?: string | null
  description?: string
  genres?: string[]
  keywords?: string[]
  aliases?: string[]
  homepage_url?: string
  twitter_url?: string
  youtube_url?: string
  official_url?: string
}

function slugify(name: string, eng?: string): string {
  const base = eng && eng.trim() ? eng : name
  const s = base.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s ? `${s}-${Date.now().toString(36).slice(-4)}` : `work-${Date.now().toString(36)}`
}

// 사용자가 직접 입력한 slug 정리 (한글/특수문자 제거, 소문자)
function cleanSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function createWork(userId: string, w: NewWork): Promise<{ slug: string } | null> {
  const supabase = createClient()
  const custom = w.slug?.trim() ? cleanSlug(w.slug) : ''
  const slug = custom || slugify(w.name, w.english_name)
  const { error } = await supabase.from('tags').insert({
    name: w.name.trim(),
    english_name: w.english_name?.trim() || null,
    slug,
    ip_type: w.ip_type || null,
    description: w.description?.trim() || null,
    genres: w.genres ?? [],
    keywords: w.keywords ?? [],
    aliases: w.aliases ?? [],
    cover_url: w.cover_url || null,
    banner_image: w.banner_image || null,
    accent_color: w.accent_color || null,
    status: w.status || null,
    original_type: w.original_type || null,
    homepage_url: w.homepage_url || null,
    twitter_url: w.twitter_url || null,
    youtube_url: w.youtube_url || null,
    official_url: w.official_url || null,
    created_by: userId,
  } as any)
  if (error) { console.error('[createWork]', error); return null }
  return { slug }
}

// 중복 체크: 이름/영문명/별칭이 기존 작품과 겹치는지
function norm(s: string): string { return s.toLowerCase().replace(/\s+/g, '').trim() }
export async function findDuplicateWork(name: string, eng: string, aliases: string[]): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.from('tags').select('name, english_name, aliases')
  const cands = new Set<string>([name, eng, ...aliases].map(norm).filter(Boolean))
  for (const row of (data ?? []) as any[]) {
    const existing = [row.name, row.english_name, ...(row.aliases ?? [])].map((x: any) => norm(x || '')).filter(Boolean)
    if (existing.some((e: string) => cands.has(e))) return row.name
  }
  return null
}

export async function getWorkForEdit(id: string) {
  const supabase = createClient()
  const { data } = await supabase.from('tags').select('*').eq('id', id).maybeSingle()
  return data as any
}

export async function updateWork(id: string, w: NewWork): Promise<boolean> {
  const supabase = createClient()
  const custom = w.slug?.trim() ? cleanSlug(w.slug) : ''
  const { error } = await supabase.from('tags').update({
    name: w.name.trim(),
    slug: custom || slugify(w.name, w.english_name),
    english_name: w.english_name?.trim() || null,
    ip_type: w.ip_type || null,
    description: w.description?.trim() || null,
    genres: w.genres ?? [],
    keywords: w.keywords ?? [],
    aliases: w.aliases ?? [],
    cover_url: w.cover_url || null,
    banner_image: w.banner_image || null,
    accent_color: w.accent_color || null,
    status: w.status || null,
    original_type: w.original_type || null,
    homepage_url: w.homepage_url || null,
    twitter_url: w.twitter_url || null,
    youtube_url: w.youtube_url || null,
    official_url: w.official_url || null,
  } as any).eq('id', id)
  if (error) { console.error('[updateWork]', error); return false }
  return true
}
