import { createClient } from '@/lib/supabase/client'

export interface GoodsType {
  id: string
  name: string
  slug: string
  icon: string | null
  isCollectible: boolean
  sortOrder: number
}

export async function getAllGoodsTypes(): Promise<GoodsType[]> {
  const supabase = createClient()
  const { data } = await supabase.from('goods_types').select('*').eq('is_active', true).order('sort_order')
  return (data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    icon: d.icon,
    isCollectible: d.is_collectible,
    sortOrder: d.sort_order,
  }))
}

export async function createGoodsType(name: string, slug: string, icon: string, isCollectible: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('goods_types')
    .insert({ name, slug, icon, is_collectible: isCollectible } as any)
  return !error
}

export async function updateGoodsType(id: string, data: Partial<{ name: string; slug: string; icon: string; isCollectible: boolean; sortOrder: number }>): Promise<boolean> {
  const supabase = createClient()
  const payload: any = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.slug !== undefined) payload.slug = data.slug
  if (data.icon !== undefined) payload.icon = data.icon
  if (data.isCollectible !== undefined) payload.is_collectible = data.isCollectible
  if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder
  const { error } = await supabase.from('goods_types').update(payload).eq('id', id)
  return !error
}

export async function deleteGoodsType(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('goods_types').delete().eq('id', id)
  return !error
}