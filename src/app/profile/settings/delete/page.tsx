import type { Metadata } from 'next'
import DeleteAccountPage from '@/components/settings/DeleteAccountPage'

export const metadata: Metadata = { title: '회원 탈퇴', robots: { index: false } }

export default function Page() {
  return <DeleteAccountPage />
}
