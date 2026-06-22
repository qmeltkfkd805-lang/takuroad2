import { createClient } from '@/lib/supabase/client'

export async function getShopHighlights(shopId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_highlights')
    .select('*')
    .eq('shop_id', shopId)
    .order('sort_order')
  return data ?? []
}

export async function createHighlight(shopId: string, title: string, imageUrl: string | null, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_highlights')
    .insert({ shop_id: shopId, title, image_url: imageUrl, created_by: userId } as any)
  return !error
}

export async function deleteHighlight(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_highlights')
    .delete()
    .eq('id', id)
  return !error
}

export async function uploadHighlightImage(file: File, shopSlug: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `${shopSlug}/highlights/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('shop-images')
    .upload(path, file)

  if (error) return null

  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}