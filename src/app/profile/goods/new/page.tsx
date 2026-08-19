'use client'

import { useRouter } from 'next/navigation'
import SettingsSubShell from '@/components/settings/SettingsSubShell'
import { EmptyState } from '@/components/tds'

// Phase 1 임시: 굿즈 등록 폼은 Phase 2에서 구현. 링크 404 방지용 안내 화면.
export default function Page() {
  const router = useRouter()
  return (
    <SettingsSubShell title="새 굿즈 올리기" onBack={() => router.back()}>
      <EmptyState
        title="굿즈 등록은 곧 열려요"
        description="사진과 작품만으로 간편하게 올리는 등록 화면을 준비하고 있어요."
        action={{ label: '내 굿즈로 돌아가기', onClick: () => router.replace('/profile/goods') }}
      />
    </SettingsSubShell>
  )
}
