'use client'

/* 샵 상세 — PC·모바일 모두 같은 화면(ShopDetailPageDesktop)을 쓴다.
   모바일 폭 맞춤은 ShopDetailPageDesktop 안의 CSS(@media)가 한다. */
import { Shop } from '@/types/shop'
import ShopDetailPageDesktop from './ShopDetailPageDesktop'

interface Props {
  shop: Shop
}

export default function ShopDetailPage({ shop }: Props) {
  return <ShopDetailPageDesktop shop={shop} />
}
