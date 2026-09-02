import { Suspense } from 'react'
import AdminPage from '@/components/admin/AdminPage'

export const metadata = {
  title: '관리자',
}

/* AdminPage가 현재 탭을 주소(?tab=)에서 읽으려고 useSearchParams()를 쓴다.
   이 라우트는 정적으로 프리렌더되기 때문에 Suspense로 감싸지 않으면
   프로덕션 빌드가 "Missing Suspense boundary with useSearchParams"로 실패한다.
   (개발 서버는 라우트를 요청 때마다 렌더해서 없어도 되는 것처럼 보인다) */
export default function Admin() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>}>
      <AdminPage />
    </Suspense>
  )
}
