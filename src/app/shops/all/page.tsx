import { Suspense } from 'react'
import ShopAllPage from '@/components/shop/ShopAllPage'

// useSearchParams를 쓰므로 Suspense가 필요하다
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ShopAllPage />
    </Suspense>
  )
}
