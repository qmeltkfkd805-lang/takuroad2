import type { Metadata } from 'next'
import BlockedSettingsPage from '@/components/settings/BlockedSettingsPage'

export const metadata: Metadata = { title: '차단 관리' }

export default function Page() {
  return <BlockedSettingsPage />
}
