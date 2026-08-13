import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: '프로필 익명화 (개발용)' }

/* 진짜 계정 삭제 기능이 없으므로 운영(production)에서는 접근을 막는다.
   컴포넌트는 동적 import라 이 경로 진입 + 개발 환경일 때만 로드된다(운영 초기 번들과 분리). */
export default async function Page() {
  if (process.env.NODE_ENV === 'production') redirect('/profile/settings')
  const { default: DeleteAccountPage } = await import('@/components/settings/DeleteAccountPage')
  return <DeleteAccountPage />
}
