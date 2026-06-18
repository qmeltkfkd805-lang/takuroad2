// ============================================================
// UI용 Review 타입
// DB의 reviews + profiles + review_images JOIN 결과
// ============================================================
export interface Review {
  id: string
  shop_id: string
  user_id: string | null
  stars: number
  content: string | null
  likes: number
  is_deleted: boolean
  created_at: string
  updated_at: string

  // profiles JOIN
  author: {
    id: string
    nickname: string
    avatar_url: string | null
  } | null

  // review_images JOIN
  images: string[]
}

// 리뷰 작성 폼
export interface ReviewFormData {
  stars: number
  content: string
  images: File[]
}
