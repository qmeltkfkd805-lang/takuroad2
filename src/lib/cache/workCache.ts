import { revalidatePath, revalidateTag } from 'next/cache'

/* 작품 캐시 (2026-10-15)
   작품 목록(/api/works/all)은 5분, 작품 상세(/work/[slug])는 2분 동안 만들어 둔 걸 나눠 준다.
   그래서 작품 사진을 바꾸거나 지워도 한참 옛날 사진이 보였다
   → 작품이 수정되면 그 순간 purgeWorks()로 비워서 바로 반영한다. */
export const WORKS_TAG = 'public-works'

/** 서버 전용 — 작품 목록·상세 캐시를 지금 비운다 (다음 요청 때 새로 만든다) */
export function purgeWorks(slug?: string | null) {
  revalidateTag(WORKS_TAG, { expire: 0 })
  revalidatePath('/api/works/all')
  revalidatePath('/my-works')
  if (slug) revalidatePath(`/work/${slug}`)
}
