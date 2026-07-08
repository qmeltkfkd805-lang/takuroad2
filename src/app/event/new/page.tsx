import { Suspense } from 'react'
import EventFormWizard from '@/components/event/EventFormWizard'

// useSearchParams(?tag=, ?shop=)를 쓰므로 Suspense가 필요하다
export default function Page() {
  return (
    <Suspense fallback={null}>
      <EventFormWizard />
    </Suspense>
  )
}
