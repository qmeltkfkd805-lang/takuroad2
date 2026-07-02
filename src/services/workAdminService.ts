import { createClient } from '@/lib/supabase/client'

export interface AdminTag {
  id: string
  name: string
  slug: string
  english_name: string | null
  ip_type: string | null
  release_year: number | null
  genres: string[] | null
  description: string | null
  cover_url: string | null
  banner_image: string | null
  created_at: string
}

// 관리자 목록용: 작품홈 Hero에 쓰는 컬럼까지 전부 가져온다
export async function getAllTagsFull(): Promise<AdminTag[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name, slug, english_name, ip_type, release_year, genres, description, cover_url, banner_image, created_at')
    .order('name')
  return (data ?? []) as AdminTag[]
}

// 이미지 업로드 (샵과 동일한 shop-images 버킷 재사용, works/ 경로로 정리)
// 버킷 정책이 경로를 막으면 실패할 수 있음 → 그때는 URL 직접 붙여넣기로 대체 가능
export async function uploadWorkImage(
  file: File, slug: string, kind: 'cover' | 'banner'
): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `works/${slug}/${kind}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, file)
  if (error) return null
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}
