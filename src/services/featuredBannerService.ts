import { createClient } from '@/lib/supabase/client'

export interface FeaturedBanner {
  id: string
  title: string
  subtitle: string | null
  image_url: string | null
  cta_label: string | null
  cta_href: string | null
  bg_color: string
  text_color: string
  sort_order: number
  is_active: boolean
}

// 활성 배너만 정렬 순서대로. 운영자가 Supabase에서 켜고 끄고 순서 정함.
export async function getActiveBanners(): Promise<FeaturedBanner[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('featured_banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as FeaturedBanner[]
}
