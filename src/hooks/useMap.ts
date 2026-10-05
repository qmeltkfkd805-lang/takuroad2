'use client'

import { useState, useEffect, useRef, useCallback, RefObject } from 'react'
import { Shop } from '@/types/shop'
import { MapEvent } from '@/services/mapEventService'
import { catColor } from '@/lib/constants/categories'
import { loadMaps, createMap, createOverlay, MapInstance, OverlayHandle } from '@/lib/map/provider'

// Place 소속 샵은 place 좌표로 접어서 표시한다 (저장 좌표 lat/lng 은 안 건드림)
const dispLat = (s: any) => s.displayLat ?? s.lat ?? 0
const dispLng = (s: any) => s.displayLng ?? s.lng ?? 0

/* 📱 지도 렉 줄이기
   - 핀은 한 번 만든 DOM 을 재사용한다 (필터·선택이 바뀔 때마다 전부 지우고 다시 만들지 않음)
   - 화면 밖(여유 40%) 핀은 지도에서 떼어 두고, 이동·줌이 끝나면(idle) 다시 붙인다
   - 선택(active) 표시는 그 핀의 크기만 바꾼다 */
interface PinEntry {
  handle: OverlayHandle
  el: HTMLElement
  sig: string            // 묶인 샵 id 목록 + 색 — 바뀌면 다시 만든다
  lat: number
  lng: number
  single: boolean
  ids: string[]
  shops: Shop[]
}

interface EventPinEntry {
  handle: OverlayHandle
  sig: string
  lat: number
  lng: number
}

const PAD_RATIO = 0.4

export function useMap(containerRef: RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<MapInstance | null>(null)
  const pinsRef = useRef<Map<string, PinEntry>>(new Map())
  const eventPinsRef = useRef<Map<string, EventPinEntry>>(new Map())
  const myLocRef = useRef<OverlayHandle | null>(null)
  // 선택한 샵 위 말풍선 (내용 DOM 은 KakaoMap 이 React 포털로 채운다)
  const bubbleRef = useRef<{ handle: OverlayHandle; lat: number; lng: number } | null>(null)
  const activeIdRef = useRef<string | null>(null)
  // 클릭 핸들러는 ref 로 들고 있다가 최신 것을 부른다 (핀 DOM 재사용용)
  const onShopClickRef = useRef<(shop: Shop) => void>(() => {})
  const onGroupClickRef = useRef<(shops: Shop[]) => void>(() => {})
  const onEventClickRef = useRef<(ev: MapEvent) => void>(() => {})
  const clickRegisteredRef = useRef(false)
  const clickCbRef = useRef<() => void>(() => {})
  const [isLoaded, setIsLoaded] = useState(false)

  // 화면 안(+여유)에 있는지
  const inView = useCallback((lat: number, lng: number) => {
    const b = mapRef.current?.getBounds()
    if (!b) return true
    const dLat = (b.neLat - b.swLat) * PAD_RATIO, dLng = (b.neLng - b.swLng) * PAD_RATIO
    return lat >= b.swLat - dLat && lat <= b.neLat + dLat && lng >= b.swLng - dLng && lng <= b.neLng + dLng
  }, [])

  const cull = useCallback(() => {
    if (!mapRef.current) return
    pinsRef.current.forEach(p => { if (inView(p.lat, p.lng)) p.handle.show(); else p.handle.hide() })
    eventPinsRef.current.forEach(p => { if (inView(p.lat, p.lng)) p.handle.show(); else p.handle.hide() })
  }, [inView])

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false
    loadMaps().then(() => {
      if (cancelled || !containerRef.current) return
      mapRef.current = createMap(containerRef.current, { lat: 37.5519, lng: 127.0738, level: 8 })
      mapRef.current.addIdleListener(cull)
      setIsLoaded(true)
    })
    return () => { cancelled = true }
  }, [containerRef, cull])

  // 단일 샵 핀 — 카테고리 컬러 물방울 + 흰 점
  const buildSingleEl = (shop: Shop, color: string) => {
    const el = document.createElement('div')
    el.style.cssText = 'cursor:pointer;position:relative;width:16px;height:21px'
    el.innerHTML = `
      <svg width="16" height="21" viewBox="0 0 28 36" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));transform-origin:center bottom;transition:transform .12s ease">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="14" r="5" fill="#fff"/>
      </svg>
    `
    el.addEventListener('click', () => onShopClickRef.current(shop))
    return el
  }

  // 같은 위치 여러 샵 — 컬러 물방울 + 숫자
  const buildGroupEl = (shops: Shop[], color: string) => {
    const el = document.createElement('div')
    el.style.cssText = 'cursor:pointer;position:relative;width:24px;height:30px'
    el.innerHTML = `
      <svg width="24" height="30" viewBox="0 0 28 36" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="14" r="7" fill="#fff"/>
        <text x="14" y="14" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="900" fill="${color}">${shops.length}</text>
      </svg>
    `
    el.addEventListener('click', () => onGroupClickRef.current(shops))
    return el
  }

  const setPinActive = (p: PinEntry | undefined, on: boolean) => {
    if (!p || !p.single) return
    const svg = p.el.firstElementChild as SVGElement | null
    if (svg) svg.style.transform = on ? 'scale(1.25)' : 'scale(1)'
    try { p.handle.raw.setZIndex?.(on ? 10 : 1) } catch { /* noop */ }
  }

  const clearMarkers = useCallback(() => {
    pinsRef.current.forEach(p => p.handle.remove())
    pinsRef.current = new Map()
  }, [])

  // 같은 위치(소수점 반올림 기준) 샵들을 묶어 핀 렌더 — 바뀐 핀만 새로 만든다
  const renderMarkers = useCallback((
    shops: Shop[],
    activeId: string | null,
    onClick: (shop: Shop) => void,
    onGroupClick: (shops: Shop[]) => void
  ) => {
    onShopClickRef.current = onClick
    onGroupClickRef.current = onGroupClick
    const map = mapRef.current
    if (!map) return

    // 핀 묶기 — 같은 건물만 하나로 합친다
    //  · 같은 장소(place_id)에 속한 샵 → 한 핀
    //  · 장소가 없으면 좌표가 사실상 같을 때(소수점 5자리 ≈ 1m)만 → 같은 주소로 찍힌 샵
    //  (예전엔 소수점 3자리(≈100m)로 묶어서 옆 건물끼리도 합쳐졌음)
    const posMap = new Map<string, Shop[]>()
    for (const s of shops) {
      const la = dispLat(s), ln = dispLng(s)
      if (!la || !ln) continue
      const pid = (s as any).place_id as string | null | undefined
      const key = pid ? `p:${pid}` : `${Math.round(la * 100000)},${Math.round(ln * 100000)}`
      const g = posMap.get(key)
      if (g) g.push(s); else posMap.set(key, [s])
    }

    const next = new Map<string, PinEntry>()
    posMap.forEach((group, key) => {
      const first = group[0]
      const color = catColor((first as any).cat ?? (first.cats && first.cats[0]))
      const ids = group.map(s => s.id)
      const sig = ids.join('|') + '#' + color
      const old = pinsRef.current.get(key)
      if (old && old.sig === sig) {
        old.shops = group
        next.set(key, old)
        pinsRef.current.delete(key)
        return
      }
      const single = group.length === 1
      const el = single ? buildSingleEl(first, color) : buildGroupEl(group, color)
      const lat = dispLat(first), lng = dispLng(first)
      const handle = createOverlay(map, { lat, lng, content: el, yAnchor: 1, hidden: !inView(lat, lng) })
      next.set(key, { handle, el, sig, lat, lng, single, ids, shops: group })
    })
    // 남은 옛 핀 정리
    pinsRef.current.forEach(p => p.handle.remove())
    pinsRef.current = next

    // 선택 표시
    activeIdRef.current = activeId
    next.forEach(p => setPinActive(p, !!activeId && p.single && p.ids[0] === activeId))
  }, [inView])

  // 선택만 바뀌었을 때 — 핀 두 개만 크기 변경
  const setActive = useCallback((activeId: string | null) => {
    const prev = activeIdRef.current
    if (prev === activeId) return
    activeIdRef.current = activeId
    pinsRef.current.forEach(p => {
      if (!p.single) return
      if (p.ids[0] === prev) setPinActive(p, false)
      if (activeId && p.ids[0] === activeId) setPinActive(p, true)
    })
  }, [])

  // 이벤트 마커 — 샵 물방울 핀과 구분되게 '원형 포스터/별 배지'로.
  const clearEventMarkers = useCallback(() => {
    eventPinsRef.current.forEach(p => p.handle.remove())
    eventPinsRef.current = new Map()
  }, [])

  const renderEventMarkers = useCallback((
    events: MapEvent[],
    onClick: (ev: MapEvent) => void
  ) => {
    onEventClickRef.current = onClick
    const map = mapRef.current
    if (!map) return

    /* 같은 건물에 샵과 이벤트가 같이 있으면 이벤트 원이 샵 핀을 덮어 샵이 안 보였다.
       → 샵 핀 근처(약 15m)의 이벤트 핀은 샵 핀 오른쪽 위로 비켜 놓고,
         같은 자리 이벤트가 여럿이면 옆으로 나란히 늘어놓는다. (화면 픽셀 기준이라 확대/축소해도 같은 모양) */
    const shopPts: { lat: number; lng: number }[] = []
    pinsRef.current.forEach(p => shopPts.push({ lat: p.lat, lng: p.lng }))
    const NEAR_LAT = 0.00014, NEAR_LNG = 0.00017
    const nearShop = (lat: number, lng: number) => shopPts.some(p => Math.abs(p.lat - lat) < NEAR_LAT && Math.abs(p.lng - lng) < NEAR_LNG)
    const slotCount = new Map<string, number>()
    const offsetOf = (lat: number, lng: number) => {
      const k = `${Math.round(lat * 7000)},${Math.round(lng * 6000)}`   // ≈15m 칸
      const i = slotCount.get(k) ?? 0
      slotCount.set(k, i + 1)
      if (nearShop(lat, lng)) return { dx: 24 + i * 22, dy: -22 }
      return { dx: i * 22, dy: 0 }
    }

    const next = new Map<string, EventPinEntry>()
    events.forEach(ev => {
      if (!ev.lat || !ev.lng) return
      const key = String(ev.id)
      const off = offsetOf(ev.lat, ev.lng)
      const sig = `${ev.lat},${ev.lng},${ev.coverUrl ?? ''},${off.dx},${off.dy}`
      const old = eventPinsRef.current.get(key)
      if (old && old.sig === sig) { next.set(key, old); eventPinsRef.current.delete(key); return }
      const el = document.createElement('div')
      el.style.cssText = 'cursor:pointer;width:34px;height:34px'
      if (off.dx || off.dy) el.style.transform = `translate(${off.dx}px, ${off.dy}px)`
      el.innerHTML = ev.coverUrl
        ? `<div style="width:34px;height:34px;border-radius:50%;border:2.5px solid #e8006f;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.35);background:#fff"><img src="${ev.coverUrl}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover" /></div>`
        : `<div style="width:30px;height:30px;border-radius:50%;border:2.5px solid #fff;background:#e8006f;box-shadow:0 1px 3px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg></div>`
      el.addEventListener('click', () => onEventClickRef.current(ev))
      const handle = createOverlay(map, { lat: ev.lat, lng: ev.lng, content: el, yAnchor: 0.5, xAnchor: 0.5, hidden: !inView(ev.lat, ev.lng) })
      next.set(key, { handle, sig, lat: ev.lat, lng: ev.lng })
    })
    eventPinsRef.current.forEach(p => p.handle.remove())
    eventPinsRef.current = next
  }, [inView])

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
      lat, lng, content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 20,
    })
  }, [])

  const moveCenter = useCallback((lat: number, lng: number, level = 4) => {
    if (!mapRef.current) return
    mapRef.current.setCenter(lat, lng)
    mapRef.current.setLevel(level)
  }, [])

  // 지도 클릭 — 리스너는 한 번만 달고, 콜백은 ref 로 최신 유지 (중복 등록 방지)
  const onMapClick = useCallback((cb: () => void) => {
    clickCbRef.current = cb
    if (!mapRef.current || clickRegisteredRef.current) return
    clickRegisteredRef.current = true
    mapRef.current.addClickListener(() => clickCbRef.current())
  }, [])

  const relayout = useCallback(() => {
    if (!mapRef.current) return
    const c = mapRef.current.getCenter()
    mapRef.current.relayout()
    mapRef.current.setCenter(c.lat, c.lng)
  }, [])

  // 말풍선 — 샵 위치(핀 위)에 띄운다. 핀과 따로 관리해서 화면 밖 핀 숨기기와 상관없이 보인다
  const showBubble = useCallback((lat: number, lng: number, el: HTMLElement) => {
    const map = mapRef.current
    if (!map) return
    bubbleRef.current?.handle.remove()
    const handle = createOverlay(map, { lat, lng, content: el, yAnchor: 1, xAnchor: 0.5, zIndex: 50 })
    bubbleRef.current = { handle, lat, lng }
  }, [])

  const hideBubble = useCallback(() => {
    bubbleRef.current?.handle.remove()
    bubbleRef.current = null
  }, [])

  // 말풍선이 화면(위 필터·아래 여백 제외) 안에 다 들어오게 지도를 살짝 민다
  const fitBubble = useCallback((el: HTMLElement, pad: { top: number; bottom: number; side: number }) => {
    const map = mapRef.current, b = bubbleRef.current
    if (!map || !b) return
    const p = map.pointOf(b.lat, b.lng)
    if (!p) return
    const { w, h } = map.getSize()
    const bw = el.offsetWidth, bh = el.offsetHeight
    const top = p.y - bh, left = p.x - bw / 2, right = p.x + bw / 2
    // dx·dy = 지도 중심을 옮길 거리 (중심이 위로 가면 말풍선은 화면 아래로 내려온다)
    let dx = 0, dy = 0
    if (top < pad.top) dy = top - pad.top                          // 위 필터에 가리면 → 말풍선을 아래로
    else if (p.y > h - pad.bottom) dy = p.y - (h - pad.bottom)     // 아래로 넘치면 → 위로
    if (bw + pad.side * 2 <= w) {
      if (left < pad.side) dx = left - pad.side
      else if (right > w - pad.side) dx = right - (w - pad.side)
    } else {
      dx = p.x - w / 2   // 화면보다 넓으면 가운데로
    }
    if (dx || dy) map.panBy(dx, dy)
  }, [])

  return { isLoaded, moveCenter, onMapClick, renderMarkers, setActive, renderEventMarkers, clearMarkers, clearEventMarkers, setMyLocation, relayout, showBubble, hideBubble, fitBubble }
}
