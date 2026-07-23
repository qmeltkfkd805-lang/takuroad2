import { Suspense } from 'react'
import NoticeWritePage from '@/components/notice/NoticeWritePage'

export const metadata = { title: '공지 작성 · 타쿠로드' }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NoticeWritePage />
    </Suspense>
  )
}