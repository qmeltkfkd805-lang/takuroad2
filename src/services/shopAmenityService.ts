import { createClient } from '@/lib/supabase/client'

export interface ShopAmenity {
  id: string
  category: 'service' | 'facility' | 'payment' | 'sales_style' | 'highlight'
  name: string
  slug: string
  icon: string | null
}

export const CATEGORY_LABEL: Record<string, string> = {
  highlight: '샵 특징',
  service: '서비스',
  facility: '편의시설',
  payment: '결제수단',
  sales_style: '판매 방식',
}

export async function getAllAmenities(): Promise<Record<string, ShopAmenity[]>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_amenities')
    .select('*')
    .order('sort_order')

  const grouped: Record<string, ShopAmenity[]> = {}
  for (const item of data ?? []) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push({
      id: item.id, category: item.category, name: item.name, slug: item.slug, icon: item.icon,
    })
  }
  return grouped
}

export async function getShopAmenityIds(shopId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_amenity_links')
    .select('amenity_id')
    .eq('shop_id', shopId)
  return (data ?? []).map((d: any) => d.amenity_id)
}

export async function getShopAmenities(shopId: string): Promise<Record<string, ShopAmenity[]>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shop_amenity_links')
    .select('shop_amenities!shop_amenity_links_amenity_id_fkey ( id, category, name, slug, icon )')
    .eq('shop_id', shopId)

  

  if (error) {
    return {}
  }

  const grouped: Record<string, ShopAmenity[]> = {}
  for (const row of (data ?? []) as any[]) {
    const a = row.shop_amenities
    if (!a) continue
    if (!grouped[a.category]) grouped[a.category] = []
    grouped[a.category].push(a)
  }
  return grouped
}

export async function updateShopAmenities(shopId: string, amenityIds: string[]): Promise<boolean> {
  const supabase = createClient()
  await supabase.from('shop_amenity_links').delete().eq('shop_id', shopId)
  if (amenityIds.length === 0) return true
  const { error } = await supabase
    .from('shop_amenity_links')
    .insert(amenityIds.map(id => ({ shop_id: shopId, amenity_id: id })) as any)
  return !error
}