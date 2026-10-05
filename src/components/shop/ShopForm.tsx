'use client'

/* 샵 등록·수정 — PC·모바일 모두 같은 단계형 화면(ShopFormWizard)을 쓴다.
   (예전 모바일 전용 한 장짜리 폼은 없앴다. 영업시간 입력·사진·작품 연결이 PC와 똑같다.) */
import { Shop } from '@/types/shop'
import ShopFormWizard from './ShopFormWizard'

interface Props {
  mode: 'create' | 'edit'
  shop?: Shop
}

export default function ShopForm({ mode, shop }: Props) {
  return <ShopFormWizard mode={mode} shop={shop} />
}
