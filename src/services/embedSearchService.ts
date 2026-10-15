import { createClient } from '@/lib/supabase/client'

/* 글쓰기 '샵·이벤트 카드 넣기'용 찾기 (2026-10-15) — 이름으로 찾아 카드에 필요한 것만 */
export interface EmbedShop { id: string; slug: string; name: string; addr: string | null; image: string | null }
export interface EmbedEvent { id: string; title: string; cover: string | null; start: string | null; end: string | null; place: string | null }

const clean = (q: string) => q.trim().replace(/[,()%*\\]/g, '')

export async function searchShopsForEmbed(q: string): Promise<EmbedShop[]> {
  const kw = clean(q)
  if (!kw) return []
  const { data, error } = await createClient()
    .from('shops')
    .select('id, slug, name, addr, shop_images ( image_url, is_cover, sort_order )')
    .in('status', ['active', 'temporary_closed'])
    .or(`name.ilike.%${kw}%,name_en.ilike.%${kw}%`)
    .limit(12)
  if (error) { console.error('[샵 카드 찾기]', error.message); return [] }
  return ((data ?? []) as any[]).map(r => {
    const imgs = [...(r.shop_images ?? [])].sort((a: any, b: any) => (Number(b.is_cover) - Number(a.is_cover)) || ((a.sort_order ?? 0) - (b.sort_order ?? 0)))
    return { id: String(r.id), slug: r.slug, name: r.name, addr: r.addr ?? null, image: imgs[0]?.image_url ?? null }
  })
}

export async function searchEventsForEmbed(q: string): Promise<EmbedEvent[]> {
  const kw = clean(q)
  let query = createClient()
    .from('events')
    .select('id, title, cover_url, start_date, end_date, place_name, shops ( name )')
    .is('deleted_at', null)
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(12)
  if (kw) query = query.ilike('title', `%${kw}%`)
  const { data, error } = await query
  if (error) { console.error('[이벤트 카드 찾기]', error.message); return [] }
  return ((data ?? []) as any[]).map(r => ({
    id: String(r.id), title: r.title ?? '', cover: r.cover_url ?? null,
    start: r.start_date ?? null, end: r.end_date ?? null, place: r.place_name ?? r.shops?.name ?? null,
  }))
}

/** 내가 저장한 샵 (최근 저장 순) */
export async function getSavedShopsForEmbed(userId: string): Promise<EmbedShop[]> {
  const { data, error } = await createClient()
    .from('saved_shops')
    .select('created_at, shops ( id, slug, name, addr, status, shop_images ( image_url, is_cover, sort_order ) )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) { console.error('[저장한 샵]', error.message); return [] }
  return ((data ?? []) as any[]).map(d => d.shops).filter((r: any) => r && r.status !== 'deleted' && r.status !== 'hidden').map((r: any) => {
    const imgs = [...(r.shop_images ?? [])].sort((a: any, b: any) => (Number(b.is_cover) - Number(a.is_cover)) || ((a.sort_order ?? 0) - (b.sort_order ?? 0)))
    return { id: String(r.id), slug: r.slug, name: r.name, addr: r.addr ?? null, image: imgs[0]?.image_url ?? null }
  })
}

/** 내가 저장한 이벤트 (최근 저장 순) */
export async function getSavedEventsForEmbed(userId: string): Promise<EmbedEvent[]> {
  const { data, error } = await createClient()
    .from('saved_events')
    .select('created_at, events ( id, title, cover_url, start_date, end_date, place_name, deleted_at, shops ( name ) )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) { console.error('[저장한 이벤트]', error.message); return [] }
  return ((data ?? []) as any[]).map(d => d.events).filter((r: any) => r && !r.deleted_at).map((r: any) => ({
    id: String(r.id), title: r.title ?? '', cover: r.cover_url ?? null,
    start: r.start_date ?? null, end: r.end_date ?? null, place: r.place_name ?? r.shops?.name ?? null,
  }))
}
