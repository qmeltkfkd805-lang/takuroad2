import { Suspense } from 'react'
import SearchPage from '@/components/search/SearchPage'

export const metadata = {
  title: '검색',
}

export default function Search() {
  return (
    <Suspense fallback={
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
        로딩 중...
      </div>
    }>
      <SearchPage />
    </Suspense>
  )
}