import { Suspense } from 'react'
import ShopAllPage from '@/components/shop/ShopAllPage'
import { pageMeta } from '@/lib/seo/pageMeta'

export const metadata = pageMeta({
  title: '전체 굿즈샵',
  description: '타쿠로드에 등록된 애니·만화·게임 굿즈샵 전체 목록. 지역·카테고리·작품으로 걸러서 찾아보세요.',
  path: '/shops/all',
})

// useSearchParams를 쓰므로 Suspense가 필요하다
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ShopAllPage />
    </Suspense>
  )
}
