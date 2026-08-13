import type { Metadata } from 'next'
import SettingsPage from '@/components/settings/SettingsPage'

export const metadata: Metadata = { title: '계정 설정' }

export default function Page() {
  return <SettingsPage />
}
