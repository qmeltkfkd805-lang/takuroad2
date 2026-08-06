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
  links?: { label: string; url: string }[]   // 공식 링크 — 원하는 만큼
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
  const row: any = {
    name: w.name.trim(),
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
    links: w.links ?? [],
    created_by: userId,
  }
  let finalSlug = slug
  let { data, error } = await supabase.from('tags').insert({ ...row, slug: finalSlug }).select('id').single()
  // 슬러그 중복(23505)이면 랜덤 접미사 붙여 한 번 더 시도
  if (error?.code === '23505') {
    finalSlug = `${slug}-${Date.now().toString(36).slice(-4)}`
    ;({ data, error } = await supabase.from('tags').insert({ ...row, slug: finalSlug }).select('id').single())
  }
  if (error) { console.error('[createWork]', error.code, '|', error.message, '|', error.details, '|', error.hint); return null }

  /* ⭐ 작품 등록도 덕질 기여다 — activity_logs에 남긴다.
     ref_id = tag id. distinct로 세면 '서로 다른 작품 N개'가 된다.
     (샵 등록처럼 승인 개념이 없어 등록 즉시 기록한다) */
  try {
    const { createActivity } = await import('./activityService')
    await createActivity({
      userId,
      type: 'work_register',
      refType: 'work',
      refId: (data as any)?.id ?? undefined,
      workId: (data as any)?.id ?? null,
      snapshot: { work_name: w.name.trim(), work_slug: finalSlug, ip_type: w.ip_type ?? null },
    })
  } catch (e) { console.error('[작품 등록 활동 기록 실패]', e) }

  return { slug: finalSlug }
}

// 관리자: 작품 삭제 (RLS로 관리자만 허용돼야 함)
export async function deleteWork(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) { console.error('[deleteWork]', error.code, '|', error.message, '|', error.details); return { ok: false, error: error.message } }
  return { ok: true }
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

/**
 * 자유 입력 태그(keywords)가 서로 다른 작품 minCount개 이상에서 쓰이면
 * '고정 장르 후보'로 승격 — 그 태그 목록을 돌려준다.
 * (장르 목록이 코드 상수라, 여기서 실제 데이터로 파생해 장르 칩에 합쳐 보여준다)
 */
const normTag = (s: string) => s.trim().replace(/\s+/g, ' ')
export async function getPromotedGenres(minCount = 3, exclude: string[] = []): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase.from('tags').select('keywords')
  const excl = new Set(exclude.map(normTag))
  const counts = new Map<string, number>()   // 태그(표시용) → 쓰인 작품 수
  for (const row of (data ?? []) as any[]) {
    const kws = Array.isArray(row.keywords) ? row.keywords : []
    const seen = new Set<string>()            // 한 작품 안 중복은 1번만
    for (const k of kws) {
      if (typeof k !== 'string') continue
      const t = normTag(k)
      if (!t || seen.has(t) || excl.has(t)) continue
      seen.add(t)
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .map(([t]) => t)
    .sort((a, b) => a.localeCompare(b, 'ko'))
}

export async function getWorkForEdit(id: string) {
  const supabase = createClient()
  const { data } = await supabase.from('tags').select('*').eq('id', id).maybeSingle()
  return data as any
}

export async function updateWork(id: string, w: NewWork): Promise<{ slug: string } | null> {
  const supabase = createClient()
  const custom = w.slug?.trim() ? cleanSlug(w.slug) : ''
  const slug = custom || slugify(w.name, w.english_name)
  const { error } = await supabase.from('tags').update({
    name: w.name.trim(),
    slug,
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
    links: w.links ?? [],
  } as any).eq('id', id)
  if (error) { console.error('[updateWork]', error); return null }
  return { slug }
}
