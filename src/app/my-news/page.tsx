import type { Metadata } from 'next'
import MyNewsPage from '@/components/news/MyNewsPage'

export const metadata: Metadata = { title: '최애 새소식' }

export default function Page() {
  return <MyNewsPage />
}
