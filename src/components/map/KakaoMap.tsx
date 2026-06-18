'use client'

import { useRef, useEffect } from 'react'
import { Shop } from '@/types/shop'
import { useMap } from '@/hooks/useMap'

interface KakaoMapProps {
  shops: Shop[]
  activeShopId: string | null
  onSelectShop: (shop: Shop) => void
  onMapClick: () => void
}

export default function KakaoMap({
  shops,
  activeShopId,
  onSelectShop,
  onMapClick,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isLoaded, renderMarkers, onMapClick: registerClick } = useMap(containerRef)

  // 지도 클릭 이벤트 등록
  useEffect(() => {
    if (!isLoaded) return
    registerClick(onMapClick)
  }, [isLoaded, registerClick, onMapClick])

  // 마커 렌더링
  useEffect(() => {
    if (!isLoaded) return
    renderMarkers(shops, activeShopId, onSelectShop)
  }, [isLoaded, shops, activeShopId, renderMarkers, onSelectShop])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
