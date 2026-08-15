import { Suspense } from 'react'
import MyActivityPage from '@/components/activity/MyActivityPage'

export const metadata = {
  title: '내 활동 기록 · 타쿠로드',
}

export default function Activity() {
  return (
    <Suspense>
      <MyActivityPage />
    </Suspense>
  )
}
