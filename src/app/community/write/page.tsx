import { Suspense } from 'react'
import PostWritePage from '@/components/community/PostWritePage'

// 탭 제목 — 예전엔 기본값 '타쿠로드 | 덕후의 성지순례 지도'가 떠서 글쓰기 중인지 알 수 없었다 (2026-10-18)
export const metadata = { title: '글쓰기', robots: { index: false } }

export default function Page() {
  return <Suspense><PostWritePage /></Suspense>
}