import { Suspense } from 'react'
import RouteListPage from '@/components/route/RouteListPage'

export const metadata = {
  title: '전체 루트',
  description: '타쿠로드의 모든 공개 루트를 검색하고 비교해보세요.',
}

// useSearchParams를 쓰므로 Suspense가 필요하다
export default function Page() {
  return (
    <Suspense fallback={null}>
      <RouteListPage />
    </Suspense>
  )
}
