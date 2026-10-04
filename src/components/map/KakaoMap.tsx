'use client'

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Shop } from '@/types/shop'
import { MapEvent } from '@/services/mapEventService'
import { useMap } from '@/hooks/useMap'

interface KakaoMapProps {
  shops: Shop[]
  events?: MapEvent[]
  activeShopId: string | null
  myLocation: { lat: number; lng: number } | null
  onSelectShop: (shop: Shop) => void
  onSelectEvent?: (ev: MapEvent) => void
  onMapClick: () => void
  onSelectGroup: (shops: Shop[]) => void
}

export interface KakaoMapRef {
  moveCenter: (lat: number, lng: number, level?: number) => void
  relayout: () => void
  /** 카카오 지도가 다 준비됐는지 */
  isReady: () => boolean
}

const KakaoMap = forwardRef<KakaoMapRef, KakaoMapProps>(function KakaoMap({
  shops,
  events,
  activeShopId,
  myLocation,
  onSelectShop,
  onSelectEvent,
  onMapClick,
  onSelectGroup,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isLoaded, renderMarkers, setActive, renderEventMarkers, onMapClick: registerClick, moveCenter, setMyLocation, relayout } = useMap(containerRef)
  // 핸들러·선택값은 ref 로 — 핀 다시 그리기는 샵 목록이 바뀔 때만
  const activeRef = useRef(activeShopId)
  activeRef.current = activeShopId
  const selShopRef = useRef(onSelectShop); selShopRef.current = onSelectShop
  const selGroupRef = useRef(onSelectGroup); selGroupRef.current = onSelectGroup
  const selEventRef = useRef(onSelectEvent); selEventRef.current = onSelectEvent

  const loadedRef = useRef(false)
  loadedRef.current = isLoaded
  useImperativeHandle(ref, () => ({
    moveCenter,
    relayout,
    isReady: () => loadedRef.current,
  }), [moveCenter, relayout])

  useEffect(() => {
    if (!isLoaded) return
    registerClick(onMapClick)
  }, [isLoaded, registerClick, onMapClick])

  useEffect(() => {
    if (!isLoaded) return
    renderMarkers(shops, activeRef.current, s => selShopRef.current(s), g => selGroupRef.current(g))
  }, [isLoaded, shops, renderMarkers])

  // 선택만 바뀌면 핀 크기만 바꾼다
  useEffect(() => {
    if (!isLoaded) return
    setActive(activeShopId)
  }, [isLoaded, activeShopId, setActive])

  useEffect(() => {
    if (!isLoaded) return
    renderEventMarkers(events ?? [], ev => selEventRef.current?.(ev))
  }, [isLoaded, events, renderEventMarkers])

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
