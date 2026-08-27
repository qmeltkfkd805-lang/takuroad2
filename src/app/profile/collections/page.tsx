import { redirect } from 'next/navigation'

// 작품별 컬렉션은 내 굿즈 페이지의 탭으로 통합됨. 기존 링크·북마크 호환용 리다이렉트.
export default function Page() {
  redirect('/profile/goods?tab=collections')
}
