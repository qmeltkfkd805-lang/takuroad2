import { Suspense } from 'react'
import EventAllPage from '@/components/event/EventAllPage'

// useSearchParams는 Suspense 안에 있어야 빌드가 통과한다
export default function Page() {
  return (
    <Suspense fallback={null}>
      <EventAllPage />
    </Suspense>
  )
}
