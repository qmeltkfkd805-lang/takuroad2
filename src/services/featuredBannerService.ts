import { createClient } from '@/lib/supabase/client'

export interface FeaturedBanner {
  id: string
  title: string
  subtitle: string | null
  image_url: string | null
  cta_label: string | null
  cta_href: string | null
  cta_label2: string | null
  cta_href2: string | null
  bg_color: string
  text_color: string
  sort_order: number
  is_active: boolean
}

export async function getActiveBanners(): Promise<FeaturedBanner[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('featured_banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as FeaturedBanner[]
}

export async function getAllBanners(): Promise<FeaturedBanner[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('featured_banners')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data ?? []) as FeaturedBanner[]
}

// 배너 이미지 업로드 (shop-images 버킷의 banners/ 경로)
export async function uploadBannerImage(file: File): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `banners/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, file)
  if (error) {
    console.error('배너 업로드 실패:', error.message)
    return null
  }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}
