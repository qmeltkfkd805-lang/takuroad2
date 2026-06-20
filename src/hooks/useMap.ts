'use client'

import { useState, useEffect, useRef, useCallback, RefObject } from 'react'
import { Shop } from '@/types/shop'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'

declare global {
  interface Window { kakao: any }
}

interface MarkerRef {
  overlay: any
  id: string
}

export function useMap(containerRef: RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<any>(null)
  const markersRef = useRef<MarkerRef[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    function initMap() {
      if (!window.kakao || !window.kakao.maps) {
        setTimeout(initMap, 100)
        return
      }
      window.kakao.maps.load(() => {
        if (!containerRef.current) return
        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(37.5519, 127.0738),
          level: 8,
        })
        mapRef.current = map
        setIsLoaded(true)
      })
    }

    initMap()
  }, [containerRef])

  // 단일 샵 마커
  const addMarker = useCallback((
    shop: Shop,
    onClick: (shop: Shop) => void,
    isActive: boolean
  ) => {
    if (!mapRef.current) return

    const catInfo = CATEGORY_NAME_MAP[shop.cat] ?? { color: '#e8006f' }
    const color = catInfo.color ?? '#e8006f'

    const el = document.createElement('div')
    el.style.cssText = 'cursor:pointer;display:flex;flex-direction:column;align-items:center'

    const bubble = document.createElement('div')
    const shortName = shop.name
      .replace(/\s*(홍대점|잠실점|부산점|강남점|신촌점|수원점|코엑스점|용산점|성수점).*$/, '')
      .trim() || shop.name.split(' ')[0]
    bubble.textContent = shortName
    bubble.style.cssText = [
      `background:${isActive ? '#fff' : color}`,
      `color:${isActive ? color : '#fff'}`,
      `border:2px solid ${color}`,
      'padding:4px 10px',
      'border-radius:20px',
      'font-size:12px',
      'font-weight:700',
      'white-space:nowrap',
      'box-shadow:0 2px 8px rgba(0,0,0,.15)',
    ].join(';')

    const tail = document.createElement('div')
    tail.style.cssText = [
      'width:0;height:0',
      'border-left:5px solid transparent',
      'border-right:5px solid transparent',
      `border-top:6px solid ${color}`,
      'margin:0 auto',
    ].join(';')

    el.appendChild(bubble)
    el.appendChild(tail)
    el.addEventListener('click', () => onClick(shop))

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(shop.lat ?? 0, shop.lng ?? 0),
      content: el,
      yAnchor: 1,
    })
    overlay.setMap(mapRef.current)
    markersRef.current.push({ overlay, id: shop.id })
  }, [])

  // 같은 위치 여러 샵 → 숫자 뱃지 마커
  const addGroupMarker = useCallback((
    shops: Shop[],
    onClick: (shops: Shop[]) => void
  ) => {
    if (!mapRef.current) return
    const first = shops[0]
    const color = CATEGORY_NAME_MAP[first.cat]?.color ?? '#e8006f'

    const el = document.createElement('div')
    el.style.cssText = 'cursor:pointer;display:flex;flex-direction:column;align-items:center'

    const bubble = document.createElement('div')
    bubble.textContent = `📍 ${shops.length}곳`
    bubble.style.cssText = [
      `background:${color}`,
      'color:#fff',
      `border:2px solid ${color}`,
      'padding:5px 12px',
      'border-radius:20px',
      'font-size:13px',
      'font-weight:900',
      'white-space:nowrap',
      'box-shadow:0 2px 8px rgba(0,0,0,.2)',
    ].join(';')

    const tail = document.createElement('div')
    tail.style.cssText = [
      'width:0;height:0',
      'border-left:6px solid transparent',
      'border-right:6px solid transparent',
      `border-top:7px solid ${color}`,
      'margin:0 auto',
    ].join(';')

    el.appendChild(bubble)
    el.appendChild(tail)
    el.addEventListener('click', () => onClick(shops))

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(first.lat ?? 0, first.lng ?? 0),
      content: el,
      yAnchor: 1,
    })
    overlay.setMap(mapRef.current)
    shops.forEach(s => markersRef.current.push({ overlay, id: s.id }))
  }, [])

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.overlay.setMap(null))
    markersRef.current = []
  }, [])

  const moveCenter = useCallback((lat: number, lng: number, level = 4) => {
    if (!mapRef.current) return
    mapRef.current.setCenter(new window.kakao.maps.LatLng(lat, lng))
    mapRef.current.setLevel(level)
  }, [])

  const onMapClick = useCallback((cb: () => void) => {
    if (!mapRef.current) return
    window.kakao.maps.event.addListener(mapRef.current, 'click', cb)
  }, [])

  // 같은 위치(소수 셋째자리 반올림 기준) 샵들을 그룹핑해서 렌더링
  const renderMarkers = useCallback((
    shops: Shop[],
    activeId: string | null,
    onClick: (shop: Shop) => void,
    onGroupClick: (shops: Shop[]) => void
  ) => {
    clearMarkers()
    const posMap: Record<string, Shop[]> = {}
    shops.forEach(s => {
      if (!s.lat || !s.lng) return
      const key = `${Math.round(s.lat * 1000)},${Math.round(s.lng * 1000)}`
      if (!posMap[key]) posMap[key] = []
      posMap[key].push(s)
    })

    Object.values(posMap).forEach(group => {
      if (group.length === 1) {
        const s = group[0]
        addMarker(s, onClick, s.id === activeId)
      } else {
        addGroupMarker(group, onGroupClick)
      }
    })
  }, [clearMarkers, addMarker, addGroupMarker])

  return { isLoaded, moveCenter, onMapClick, renderMarkers, clearMarkers }
}