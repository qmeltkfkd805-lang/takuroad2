import type { Metadata } from 'next'
import PrivacySettingsPage from '@/components/settings/PrivacySettingsPage'

export const metadata: Metadata = { title: '공개 범위' }

export default function Page() {
  return <PrivacySettingsPage />
}
