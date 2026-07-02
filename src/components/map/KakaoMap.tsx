'use client'

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Shop } from '@/types/shop'
import { useMap } from '@/hooks/useMap'

interface KakaoMapProps {
  shops: Shop[]
  activeShopId: string | null
  myLocation: { lat: number; lng: number } | null
  onSelectShop: (shop: Shop) => void
  onMapClick: () => void
  onSelectGroup: (shops: Shop[]) => void
}

export interface KakaoMapRef {
  moveCenter: (lat: number, lng: number, level?: number) => void
  relayout: () => void
}

const KakaoMap = forwardRef<KakaoMapRef, KakaoMapProps>(function KakaoMap({
  shops,
  activeShopId,
  myLocation,
  onSelectShop,
  onMapClick,
  onSelectGroup,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isLoaded, renderMarkers, onMapClick: registerClick, moveCenter, setMyLocation, relayout } = useMap(containerRef)

  useImperativeHandle(ref, () => ({
    moveCenter,
    relayout,
  }), [moveCenter, relayout])

  useEffect(() => {
    if (!isLoaded) return
    registerClick(onMapClick)
  }, [isLoaded, registerClick, onMapClick])

  useEffect(() => {
    if (!isLoaded) return
    renderMarkers(shops, activeShopId, onSelectShop, onSelectGroup)
  }, [isLoaded, shops, activeShopId, renderMarkers, onSelectShop, onSelectGroup])

  useEffect(() => {
    if (!isLoaded || !myLocation) return
    setMyLocation(myLocation.lat, myLocation.lng)
  }, [isLoaded, myLocation, setMyLocation])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
})

export default KakaoMap
