'use client'

import { useRef, useEffect } from 'react'
import { Shop } from '@/types/shop'
import { useMap } from '@/hooks/useMap'

interface KakaoMapProps {
  shops: Shop[]
  activeShopId: string | null
  onSelectShop: (shop: Shop) => void
  onMapClick: () => void
  onSelectGroup: (shops: Shop[]) => void
}

export default function KakaoMap({
  shops,
  activeShopId,
  onSelectShop,
  onMapClick,
  onSelectGroup,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isLoaded, renderMarkers, onMapClick: registerClick } = useMap(containerRef)

  useEffect(() => {
    if (!isLoaded) return
    registerClick(onMapClick)
  }, [isLoaded, registerClick, onMapClick])

  useEffect(() => {
    if (!isLoaded) return
    renderMarkers(shops, activeShopId, onSelectShop, onSelectGroup)
  }, [isLoaded, shops, activeShopId, renderMarkers, onSelectShop, onSelectGroup])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}