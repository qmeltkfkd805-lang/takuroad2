import ShopHomePage from '@/components/shop/ShopHomePage'
import { pageMeta } from '@/lib/seo/pageMeta'

export const metadata = pageMeta({
  title: '굿즈샵 찾기',
  description: '애니·만화·게임 굿즈샵, 피규어샵, 가챠·쿠지, 카드샵을 지역·작품별로 찾아보세요. 영업시간과 취급 작품까지 한눈에.',
  path: '/shops',
})

export default function Page() {
  return <ShopHomePage />
}
