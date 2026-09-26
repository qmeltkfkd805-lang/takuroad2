import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/* 전시 편집 화면은 더 이상 쓰지 않는다.
   - 새 방식 전시: 원본 글 수정으로 반영(상세 ⋯ > 원본 글 수정)
   - 이전 방식 전시: 수정 없이 "전시에서 빼기"만 제공
   예전 주소로 들어오면 전시관으로 돌려보낸다. */
export default async function Page() {
  redirect('/profile/exhibit')
}
