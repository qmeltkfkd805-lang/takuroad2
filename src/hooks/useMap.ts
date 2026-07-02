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
  const myLocRef = useRef<any>(null)
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

  // 단일 샵 마커 — 카테고리 컬러 물방울 핀 + 흰색 solid 아이콘
  const addMarker = useCallback((
    shop: Shop,
    onClick: (shop: Shop) => void,
    isActive: boolean
  ) => {
    if (!mapRef.current) return

    const catName = (shop as any).cat ?? (shop.cats && shop.cats[0])
    const catInfo: any = CATEGORY_NAME_MAP[catName] ?? { color: '#e8006f', slug: 'goods' }
    const color = catInfo.color ?? '#e8006f'
    const iconName = `solid-${catInfo.slug ?? 'goods'}`

    const el = document.createElement('div')
    el.style.cssText = 'cursor:pointer;position:relative;width:28px;height:36px'
    el.innerHTML = `
      <svg width="28" height="36" viewBox="0 0 28 36" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.3 21.7 0 14 0z"
          fill="${isActive ? '#fff' : color}" stroke="${isActive ? color : '#fff'}" stroke-width="2"/>
      </svg>
      <span style="position:absolute;left:50%;top:14px;transform:translate(-50%,-50%);width:14px;height:14px;background-color:${isActive ? color : '#fff'};-webkit-mask:url(/icons/${iconName}.png) center/contain no-repeat;mask:url(/icons/${iconName}.png) center/contain no-repeat"></span>
    `
    el.addEventListener('click', () => onClick(shop))

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(shop.lat ?? 0, shop.lng ?? 0),
      content: el,
      yAnchor: 1,
    })
    overlay.setMap(mapRef.current)
    markersRef.current.push({ overlay, id: shop.id })
  }, [])

  // 같은 위치 여러 샵 — 컬러 물방울 핀 + 숫자
  const addGroupMarker = useCallback((
    shops: Shop[],
    onClick: (shops: Shop[]) => void
  ) => {
    if (!mapRef.current) return
    const first = shops[0]
    const catName = (first as any).cat ?? (first.cats && first.cats[0])
    const color = CATEGORY_NAME_MAP[catName]?.color ?? '#e8006f'

    const el = document.createElement('div')
    el.style.cssText = 'cursor:pointer;position:relative;width:30px;height:38px'
    el.innerHTML = `
      <svg width="30" height="38" viewBox="0 0 30 38" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 10 15 23 15 23s15-13 15-23C30 6.7 23.3 0 15 0z"
          fill="${color}" stroke="#fff" stroke-width="2"/>
      </svg>
      <span style="position:absolute;left:50%;top:15px;transform:translate(-50%,-50%);color:#fff;font-size:12px;font-weight:900;white-space:nowrap">${shops.length}</span>
    `
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

  // 현재 위치 — 파란 점 + 퍼지는 원
  const setMyLocation = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return
    if (myLocRef.current) myLocRef.current.setMap(null)

    const el = document.createElement('div')
    el.style.cssText = 'position:relative;width:22px;height:22px'
    el.innerHTML = `
      <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:rgba(51,139,255,.25);animation:myloc-pulse 2s ease-out infinite"></span>
      <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#338bff;border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.3)"></span>
    `
    if (!document.getElementById('myloc-style')) {
      const st = document.createElement('style')
      st.id = 'myloc-style'
      st.textContent = '@keyframes myloc-pulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.7}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}'
      document.head.appendChild(st)
    }

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(lat, lng),
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
    })
    overlay.setMap(mapRef.current)
    myLocRef.current = overlay
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

  // 같은 위치(소수점 반올림 기준) 샵들을 묶어 마커 렌더
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

  const relayout = useCallback(() => {
    if (!mapRef.current) return
    const c = mapRef.current.getCenter()
    mapRef.current.relayout()
    mapRef.current.setCenter(c)
  }, [])

  return { isLoaded, moveCenter, onMapClick, renderMarkers, clearMarkers, setMyLocation, relayout }
}

