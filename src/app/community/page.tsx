import CommunityPage from '@/components/community/CommunityPage'
import { pageMeta } from '@/lib/seo/pageMeta'

export const metadata = pageMeta({
  title: '커뮤니티',
  description: '굿즈 자랑, 교환·나눔, 덕메 구하기, 성지순례 후기까지 — 덕후들의 이야기를 나눠요.',
  path: '/community',
})

export default function Page() {
  return <CommunityPage />
}
