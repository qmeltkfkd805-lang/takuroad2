import { createClient } from '@/lib/supabase/client'
import { Review, ReviewFormData } from '@/types/review'

function toReview(raw: any): Review {
  return {
    id:         raw.id,
    shop_id:    raw.shop_id,
    user_id:    raw.user_id,
    stars:      raw.stars,
    content:    raw.content,
    likes:      raw.likes ?? 0,
    is_deleted: raw.is_deleted ?? false,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    author: raw.profiles ? {
      id:         raw.profiles.id,
      nickname:   raw.profiles.nickname,
      avatar_url: raw.profiles.avatar_url,
    } : null,
    images: (raw.review_images ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((img: any) => img.image_url),
  }
}

export async function getReviews(shopId: string): Promise<Review[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id, shop_id, user_id,
      stars, content, likes,
      is_deleted, created_at, updated_at,
      profiles ( id, nickname, avatar_url ),
      review_images ( image_url, sort_order )
    `)
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []).map(toReview)
}

export async function createReview(
  shopId: string,
  userId: string,
  formData: ReviewFormData
): Promise<Review | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      shop_id:  shopId,
      user_id:  userId,
      stars:    formData.stars,
      content:  formData.content,
    } as any)
    .select(`
      id, shop_id, user_id,
      stars, content, likes,
      is_deleted, created_at, updated_at,
      profiles ( id, nickname, avatar_url ),
      review_images ( image_url, sort_order )
    `)
    .single()

  if (error || !data) return null
  return toReview(data)
}

export async function updateReview(
  id: string,
  userId: string,
  formData: Pick<ReviewFormData, 'stars' | 'content'>
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('reviews')
    .update({ stars: formData.stars, content: formData.content } as never)
    .eq('id', id)
    .eq('user_id', userId)
}

export async function deleteReview(id: string, userId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('reviews')
    .update({ is_deleted: true } as any)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) console.error('deleteReview error:', JSON.stringify(error))
}

export async function uploadReviewImages(
  reviewId: string,
  files: File[]
): Promise<string[]> {
  const supabase = createClient()
  const urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop()
    const path = `${reviewId}/${i}.${ext}`

    const { error } = await supabase.storage
      .from('review-images')
      .upload(path, file, { upsert: true })

    if (!error) {
      const { data } = supabase.storage
        .from('review-images')
        .getPublicUrl(path)
      urls.push(data.publicUrl)
    }
  }

  if (urls.length > 0) {
    await supabase
      .from('review_images')
      .insert(
        urls.map((url, i) => ({
          review_id: reviewId,
          image_url: url,
          sort_order: i,
        })) as any
      )
  }

  return urls
}