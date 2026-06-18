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
      if (!containerRef.current) return
      if (mapRef.current) {
        setIsLoaded(true)
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

  const addMarker = useCallback((
    shop: Shop,
    offset: { lat: number; lng: number },
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
      position: new window.kakao.maps.LatLng(
        (shop.lat ?? 0) + offset.lat,
        (shop.lng ?? 0) + offset.lng
      ),
      content: el,
      yAnchor: 1,
    })
    overlay.setMap(mapRef.current)
    markersRef.current.push({ overlay, id: shop.id })
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

  const renderMarkers = useCallback((
    shops: Shop[],
    activeId: string | null,
    onClick: (shop: Shop) => void
  ) => {
    clearMarkers()
    const posMap: Record<string, Shop[]> = {}
    shops.forEach(s => {
      if (!s.lat || !s.lng) return
      const key = `${Math.round(s.lat * 1000)},${Math.round(s.lng * 1000)}`
      if (!posMap[key]) posMap[key] = []
      posMap[key].push(s)
    })
    shops.forEach(s => {
      if (!s.lat || !s.lng) return
      const key = `${Math.round(s.lat * 1000)},${Math.round(s.lng * 1000)}`
      const group = posMap[key]
      const idx = group.indexOf(s)
      let offset = { lat: 0, lng: 0 }
      if (group.length > 1) {
        const angle = ((2 * Math.PI) / group.length) * idx
        offset = { lat: Math.sin(angle) * 0.0003, lng: Math.cos(angle) * 0.0003 }
      }
      addMarker(s, offset, onClick, s.id === activeId)
    })
  }, [clearMarkers, addMarker])

  return { isLoaded, moveCenter, onMapClick, renderMarkers, clearMarkers }
}