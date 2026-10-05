'use client'

import { useRef, useEffect, useState, forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  /** 지도 위 말풍선 — 그 좌표(핀 위)에 content 를 띄운다. key 가 바뀌면 다시 띄우고 화면 안으로 맞춘다 */
  bubble?: { key: string; lat: number; lng: number; content: ReactNode } | null
  /** 말풍선을 맞출 때 위쪽에 비워 둘 높이(px) — 지도 위에 떠 있는 필터 등 */
  bubbleTopPad?: () => number
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
  bubble,
  bubbleTopPad,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isLoaded, renderMarkers, setActive, renderEventMarkers, onMapClick: registerClick, moveCenter, setMyLocation, relayout, showBubble, hideBubble, fitBubble } = useMap(containerRef)
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

  // 말풍선 DOM — 카카오 오버레이에 붙이고 내용은 React 포털로 그린다
  const [bubbleEl] = useState<HTMLDivElement | null>(() => {
    if (typeof document === 'undefined') return null
    const el = document.createElement('div')
    // 아래 여백 = 핀 높이만큼 띄워서 말풍선 꼬리가 핀 머리 위에 오게. 빈 여백은 핀 클릭을 막지 않는다
    el.style.cssText = 'padding-bottom:38px;pointer-events:none'
    // 말풍선 위에서 누른 걸 지도가 드래그·지도 클릭(선택 해제)으로 받지 않게
    const stop = (e: Event) => e.stopPropagation()
    el.addEventListener('mousedown', stop)
    el.addEventListener('touchstart', stop, { passive: true })
    el.addEventListener('dblclick', stop)
    return el
  })
  const topPadRef = useRef(bubbleTopPad); topPadRef.current = bubbleTopPad
  const bubbleKey = bubble ? `${bubble.key}|${bubble.lat}|${bubble.lng}` : null
  const bubblePosRef = useRef(bubble); bubblePosRef.current = bubble
  useEffect(() => {
    if (!isLoaded || !bubbleEl) return
    const b = bubblePosRef.current
    if (!bubbleKey || !b) { hideBubble(); return }
    showBubble(b.lat, b.lng, bubbleEl)
    // 지도 이동(선택한 샵으로 중심 이동)이 끝난 뒤 말풍선이 다 보이게 살짝 민다
    const t = setTimeout(() => fitBubble(bubbleEl, { top: (topPadRef.current?.() ?? 0) + 12, bottom: 90, side: 12 }), 160)
    return () => clearTimeout(t)
  }, [isLoaded, bubbleKey, bubbleEl, showBubble, hideBubble, fitBubble])
  useEffect(() => () => hideBubble(), [hideBubble])

  return (
    <>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
      {bubble && bubbleEl ? createPortal(bubble.content, bubbleEl) : null}
    </>
  )
})

export default KakaoMap
