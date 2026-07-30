'use client'

import { useState, useEffect, useRef, useCallback, RefObject } from 'react'
import { Shop } from '@/types/shop'
import { MapEvent } from '@/services/mapEventService'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import { loadMaps, createMap, createOverlay, MapInstance, OverlayHandle } from '@/lib/map/provider'

// Place 소속 샵은 place 좌표로 접어서 표시한다 (저장 좌표 lat/lng 은 안 건드림)
const dispLat = (s: any) => s.displayLat ?? s.lat ?? 0
const dispLng = (s: any) => s.displayLng ?? s.lng ?? 0

interface MarkerRef {
  handle: OverlayHandle
  id: string
}

export function useMap(containerRef: RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<MapInstance | null>(null)
  const markersRef = useRef<MarkerRef[]>([])
  const eventMarkersRef = useRef<OverlayHandle[]>([])
  const myLocRef = useRef<OverlayHandle | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false
    loadMaps().then(() => {
      if (cancelled || !containerRef.current) return
      mapRef.current = createMap(containerRef.current, { lat: 37.5519, lng: 127.0738, level: 8 })
      setIsLoaded(true)
    })
    return () => { cancelled = true }
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

    const el = document.createElement('div')
    el.style.cssText = 'cursor:pointer;position:relative;width:16px;height:21px'
    el.innerHTML = `
      <svg width="16" height="21" viewBox="0 0 28 36" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));transform:${isActive ? 'scale(1.25)' : 'scale(1)'};transform-origin:center bottom">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="14" r="5" fill="#fff"/>
      </svg>
    `
    el.addEventListener('click', () => onClick(shop))

    const handle = createOverlay(mapRef.current, {
      lat: dispLat(shop), lng: dispLng(shop), content: el, yAnchor: 1,
    })
    markersRef.current.push({ handle, id: shop.id })
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
    el.style.cssText = 'cursor:pointer;position:relative;width:24px;height:30px'
    el.innerHTML = `
      <svg width="24" height="30" viewBox="0 0 28 36" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="14" r="7" fill="#fff"/>
        <text x="14" y="14" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="900" fill="${color}">${shops.length}</text>
      </svg>
    `
    el.addEventListener('click', () => onClick(shops))

    const handle = createOverlay(mapRef.current, {
      lat: dispLat(first), lng: dispLng(first), content: el, yAnchor: 1,
    })
    shops.forEach(s => markersRef.current.push({ handle, id: s.id }))
  }, [])

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.handle.remove())
    markersRef.current = []
  }, [])

  // 이벤트 마커 — 샵 물방울 핀과 구분되게 '원형 포스터/별 배지'로.
  const clearEventMarkers = useCallback(() => {
    eventMarkersRef.current.forEach(h => h.remove())
    eventMarkersRef.current = []
  }, [])

  const renderEventMarkers = useCallback((
    events: MapEvent[],
    onClick: (ev: MapEvent) => void
  ) => {
    clearEventMarkers()
    if (!mapRef.current) return
    events.forEach(ev => {
      if (!ev.lat || !ev.lng) return
      const el = document.createElement('div')
      el.style.cssText = 'cursor:pointer;width:34px;height:34px'
      el.innerHTML = ev.coverUrl
        ? `<div style="width:34px;height:34px;border-radius:50%;border:2.5px solid #e8006f;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.35);background:#fff"><img src="${ev.coverUrl}" style="width:100%;height:100%;object-fit:cover" /></div>`
        : `<div style="width:30px;height:30px;border-radius:50%;border:2.5px solid #fff;background:#e8006f;box-shadow:0 1px 3px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg></div>`
      el.addEventListener('click', () => onClick(ev))
      const handle = createOverlay(mapRef.current!, {
        lat: ev.lat, lng: ev.lng, content: el, yAnchor: 0.5, xAnchor: 0.5,
      })
      eventMarkersRef.current.push(handle)
    })
  }, [clearEventMarkers])

  // 현재 위치 — 파란 점 + 퍼지는 원
  const setMyLocation = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return
    if (myLocRef.current) myLocRef.current.remove()

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

    myLocRef.current = createOverlay(mapRef.current, {
      lat, lng, content: el, yAnchor: 0.5, xAnchor: 0.5,
    })
  }, [])

  const moveCenter = useCallback((lat: number, lng: number, level = 4) => {
    if (!mapRef.current) return
    mapRef.current.setCenter(lat, lng)
    mapRef.current.setLevel(level)
  }, [])

  const onMapClick = useCallback((cb: () => void) => {
    if (!mapRef.current) return
    mapRef.current.addClickListener(cb)
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
      const la = dispLat(s), ln = dispLng(s)
      if (!la || !ln) return
      const key = `${Math.round(la * 1000)},${Math.round(ln * 1000)}`
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
    mapRef.current.setCenter(c.lat, c.lng)
  }, [])

  return { isLoaded, moveCenter, onMapClick, renderMarkers, renderEventMarkers, clearMarkers, setMyLocation, relayout }
}