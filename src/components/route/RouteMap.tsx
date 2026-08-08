'use client'

import { useRef, useEffect } from 'react'
import { arrowMarkers, splitReturnRuns, type RouteRun } from '@/lib/route/mapGeometry'
import { buildMarkerEl, buildCircleMarkerEl, buildArrowEl, buildClusterEl } from './map/routeMarker'

const ACCENT = '#e8006f'
const ACCENT_DARK = '#c30059'
const RETURN_COLOR = '#7c3aed'   // 되돌아가는 구간(보라) — 핑크 본선과 구분

declare global {
  interface Window { kakao: any }
}

interface RouteMapShop {
  id: string
  name: string
  lat: number
  lng: number
}

interface Props {
  shops: RouteMapShop[]
  selectedIndex?: number | null
  onSelectIndex?: (i: number) => void
  /** 실제 도보 경로 좌표 [경도(lng), 위도(lat)] — ORS 결과. 없으면 선을 그리지 않는다(직선 금지). */
  geometry?: [number, number][] | null
  /** 'route'(기본): 새 핀+ORS 경로+화살표(루트 보기 모드). 'preview': 원래 원형 마커+점선 연결(상세 미리보기). */
  variant?: 'route' | 'preview'
  /** 되돌아가는 구간 존재 여부 콜백(범례 표시용) */
  onHasReturn?: (hasReturn: boolean) => void
}

/* 루트 상세 지도 — 실제 카카오 지도.
   · 마커: 작은 흰색 번호 원 / 출발·도착 플래그 / 선택 강조 + 나머지 약화 (routeMarker)
   · 경로: 흰색 외곽선 + 핑크 실선 2중 + 진행방향 화살표
   · 컨테이너 크기 확정 후 relayout + setBounds 재맞춤 */
export default function RouteMap({ shops, selectedIndex = null, onSelectIndex, geometry = null, variant = 'route', onHasReturn }: Props) {
  const preview = variant === 'preview'
  const onHasReturnRef = useRef(onHasReturn)
  onHasReturnRef.current = onHasReturn
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any[]>([])       // CustomOverlay[]
  const arrowRef = useRef<any[]>([])
  const pathRef = useRef<any[]>([])
  const runsRef = useRef<RouteRun[]>([])
  const focusRef = useRef<any[]>([])       // 선택 시 선명한 초점 구간 폴리라인
  const spotIdxRef = useRef<number[]>([])  // 각 스팟 → 가장 가까운 geometry 점 인덱스
  const validRef = useRef<RouteMapShop[]>([])
  const roRef = useRef<ResizeObserver | null>(null)
  const didSelectRef = useRef(false)
  const geoRef = useRef<[number, number][] | null>(geometry)
  geoRef.current = geometry
  const onSelectRef = useRef(onSelectIndex)
  onSelectRef.current = onSelectIndex
  const selRef = useRef<number | null>(selectedIndex)
  selRef.current = selectedIndex

  function fitToBounds() {
    const map = mapRef.current
    const valid = validRef.current
    if (!map || !window.kakao?.maps || valid.length === 0) return
    try {
      map.relayout()
      if (valid.length > 1) {
        const b = new window.kakao.maps.LatLngBounds()
        valid.forEach(s => b.extend(new window.kakao.maps.LatLng(s.lat, s.lng)))
        map.setBounds(b, 40, 40, 40, 40)
      } else {
        map.setLevel(4)
        map.setCenter(new window.kakao.maps.LatLng(valid[0].lat, valid[0].lng))
      }
    } catch { /* noop */ }
  }

  // 되돌아가는 구간 계산(geometry 변경 시에만) — 선택 시 재계산 방지
  function computeRuns() {
    const geo = geoRef.current
    if (!geo || geo.length < 2) { runsRef.current = []; onHasReturnRef.current?.(false); return }
    const { runs, hasReturn } = splitReturnRuns(geo)
    runsRef.current = runs
    onHasReturnRef.current?.(hasReturn)
  }

  // 경로선 그리기. dim=true 면 전체를 흐리게(스팟 선택 시 초점 이동)
  function paintPath(dim = false) {
    const map = mapRef.current
    if (!map || !window.kakao?.maps) return
    const K = window.kakao.maps
    pathRef.current.forEach(p => { try { p.setMap(null) } catch { /* noop */ } })
    pathRef.current = []
    if (preview) {
      const valid = validRef.current
      if (valid.length < 2) return
      const path = valid.map(s => new K.LatLng(s.lat, s.lng))
      const under = new K.Polyline({ path, strokeWeight: 7, strokeColor: '#ffffff', strokeOpacity: 0.9, strokeStyle: 'solid' })
      under.setMap(map); pathRef.current.push(under)
      const line = new K.Polyline({ path, strokeWeight: 4, strokeColor: ACCENT, strokeOpacity: 0.95, strokeStyle: 'shortdash' })
      line.setMap(map); pathRef.current.push(line)
      return
    }
    const geo = geoRef.current
    if (!geo || geo.length < 2) return
    const opUnder = dim ? 0.5 : 0.95, opMain = dim ? 0.28 : 0.95, opRet = dim ? 0.3 : 0.95
    // 1) 전체 경로를 하나의 연속 리본으로 (흰색 8px 외곽선 + 핑크 5px 본선)
    const full = geo.map(([lng, lat]) => new K.LatLng(lat, lng))
    const under = new K.Polyline({ path: full, strokeWeight: 8, strokeColor: '#ffffff', strokeOpacity: opUnder, strokeStyle: 'solid' })
    under.setMap(map); pathRef.current.push(under)
    const main = new K.Polyline({ path: full, strokeWeight: 5, strokeColor: ACCENT, strokeOpacity: opMain, strokeStyle: 'solid' })
    main.setMap(map); pathRef.current.push(main)
    // 2) 되돌아가는 구간만 점선 오버레이(보라)
    runsRef.current.forEach(run => {
      if (run.type !== 'return') return
      const path = run.pts.map(([lng, lat]) => new K.LatLng(lat, lng))
      const ov = new K.Polyline({ path, strokeWeight: 5, strokeColor: RETURN_COLOR, strokeOpacity: opRet, strokeStyle: 'dash' })
      ov.setMap(map); pathRef.current.push(ov)
    })
  }

  // 각 스팟을 가장 가까운 geometry 점 인덱스에 매핑(초점 구간 계산용)
  function computeSpotIdx() {
    const geo = geoRef.current, valid = validRef.current
    if (!geo || geo.length < 2 || !valid.length) { spotIdxRef.current = []; return }
    spotIdxRef.current = valid.map(s => {
      let best = 0, bd = Infinity
      for (let i = 0; i < geo.length; i++) { const dx = geo[i][0] - s.lng, dy = geo[i][1] - s.lat; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i } }
      return best
    })
  }

  // 선택 스팟과 이전·다음 스팟 사이 경로 구간을 선명하게 덧그림
  function paintFocus(sel: number | null) {
    const map = mapRef.current
    focusRef.current.forEach(p => { try { p.setMap(null) } catch { /* noop */ } })
    focusRef.current = []
    if (!map || !window.kakao?.maps || preview || sel == null) return
    const geo = geoRef.current, idx = spotIdxRef.current, valid = validRef.current
    if (!geo || !idx.length) return
    const total = valid.length
    let a = idx[Math.max(0, sel - 1)], b = idx[Math.min(total - 1, sel + 1)]
    if (a == null || b == null) return
    if (a > b) { const t = a; a = b; b = t }
    const sub = geo.slice(a, b + 1)
    if (sub.length < 2) return
    const K = window.kakao.maps
    const path = sub.map(([lng, lat]) => new K.LatLng(lat, lng))
    const under = new K.Polyline({ path, strokeWeight: 8, strokeColor: '#ffffff', strokeOpacity: 0.95, strokeStyle: 'solid', zIndex: 4 })
    under.setMap(map); focusRef.current.push(under)
    const line = new K.Polyline({ path, strokeWeight: 5, strokeColor: ACCENT, strokeOpacity: 1, strokeStyle: 'solid', zIndex: 4 })
    line.setMap(map); focusRef.current.push(line)
  }

  // geometry 변경/초기: 구간 계산 + 그리기
  function drawPath() { computeRuns(); computeSpotIdx(); paintPath(selRef.current != null && !preview); paintFocus(selRef.current) }

  // 진행방향 화살표
  function drawArrows() {
    const map = mapRef.current
    if (!map || !window.kakao?.maps) return
    arrowRef.current.forEach(a => { try { a.setMap(null) } catch { /* noop */ } })
    arrowRef.current = []
    if (preview) return   // 미리보기에는 화살표 없음
    const runs = runsRef.current
    if (!runs.length) return
    const K = window.kakao.maps
    // 일반 구간 화살표는 제거 — 되돌아가는 구간에만 역방향 화살표
    runs.forEach(run => {
      if (run.type !== 'return') return
      arrowMarkers(run.pts, 90).forEach(a => {
        const ov = new K.CustomOverlay({ position: new K.LatLng(a.lat, a.lng), content: buildArrowEl(a.angle, RETURN_COLOR), yAnchor: 0.5, xAnchor: 0.5, zIndex: 2 })
        ov.setMap(map); arrowRef.current.push(ov)
      })
    })
  }

  // 마커 (선택 상태 반영 + 밀집 구간 클러스터링)
  const CLUSTER_PX = 38
  function renderMarkers() {
    const map = mapRef.current
    const valid = validRef.current
    if (!map || !window.kakao?.maps) return
    const K = window.kakao.maps
    markerRef.current.forEach(m => { try { m.setMap(null) } catch { /* noop */ } })
    markerRef.current = []
    const sel = selRef.current
    const total = valid.length
    const build = preview ? buildCircleMarkerEl : buildMarkerEl

    // 3상태: 선택 시 선택 스팟과 이전·다음만 선명, 나머지는 흐리게
    const dimOf = (i: number) => {
      if (sel == null) return false
      if (preview) return i !== sel
      return !(i === sel || i === sel - 1 || i === sel + 1)
    }
    const addSingle = (i: number) => {
      const shop = valid[i]
      const el = build({ index: i, total, selected: sel === i, dim: dimOf(i) })
      el.addEventListener('click', () => onSelectRef.current?.(i))
      const isEnd = i === 0 || i === total - 1
      const ov = new K.CustomOverlay({ position: new K.LatLng(shop.lat, shop.lng), content: el, yAnchor: 1, xAnchor: 0.5, zIndex: sel === i ? 12 : (isEnd ? 8 : 3) })
      ov.setMap(map); markerRef.current.push(ov)
    }

    // 미리보기 모드는 클러스터링 안 함(정적 썸네일 성격)
    let proj: any = null
    if (!preview) { try { proj = map.getProjection() } catch { /* noop */ } }
    const excluded = (i: number) => i === 0 || i === total - 1 || i === sel   // 출발/도착/선택 제외
    const pxOf = (i: number) => {
      try { const p = proj.containerPointFromCoords(new K.LatLng(valid[i].lat, valid[i].lng)); return { x: p.x, y: p.y } } catch { return null }
    }

    if (!proj) { valid.forEach((_, i) => addSingle(i)); return }

    let i = 0
    while (i < total) {
      const pi = pxOf(i)
      if (excluded(i) || !pi) { addSingle(i); i++; continue }
      let j = i
      const members = [i]
      while (j + 1 < total && !excluded(j + 1)) {
        const pj = pxOf(j + 1)
        if (!pj || Math.hypot(pj.x - pi.x, pj.y - pi.y) >= CLUSTER_PX) break
        j++; members.push(j)
      }
      if (members.length >= 2) {
        const shop = valid[members[0]]
        const el = buildClusterEl(members[0] + 1, members[members.length - 1] + 1, members.length)
        if (sel != null) el.style.opacity = '0.4'   // 선택 중이면 클러스터도 흐리게
        el.addEventListener('click', () => {
          try {
            const lv = Math.max(1, map.getLevel() - 2)
            map.setLevel(lv, { anchor: new K.LatLng(shop.lat, shop.lng), animate: { duration: 250 } })
          } catch { map.setLevel(Math.max(1, map.getLevel() - 2)) }
        })
        const ov = new K.CustomOverlay({ position: new K.LatLng(shop.lat, shop.lng), content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 5 })
        ov.setMap(map); markerRef.current.push(ov)
        i = j + 1
      } else { addSingle(i); i++ }
    }
  }

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    function initMap() {
      if (!window.kakao || !window.kakao.maps) { setTimeout(initMap, 100); return }
      window.kakao.maps.load(() => {
        if (cancelled || !containerRef.current) return
        const valid = shops.filter(s => s.lat && s.lng)
        validRef.current = valid
        if (valid.length === 0) return

        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(valid[0].lat, valid[0].lng),
          level: 6,
        })
        mapRef.current = map

        drawPath()
        drawArrows()
        renderMarkers()
        fitToBounds()
        try {
          const once = () => { fitToBounds(); window.kakao.maps.event.removeListener(map, 'tilesloaded', once) }
          window.kakao.maps.event.addListener(map, 'tilesloaded', once)
        } catch { /* noop */ }
        // 줌/이동 끝나면 클러스터 재계산
        try { window.kakao.maps.event.addListener(map, 'idle', renderMarkers) } catch { /* noop */ }
        ;[120, 400, 900].forEach(ms => setTimeout(fitToBounds, ms))

        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          roRef.current = new ResizeObserver(() => fitToBounds())
          roRef.current.observe(containerRef.current)
        }
      })
    }
    initMap()
    return () => { cancelled = true; if (roRef.current) { roRef.current.disconnect(); roRef.current = null } }
    // shops 변경 시에만 지도 재생성
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops])

  // geometry 변경 → 경로선/화살표 다시 그리고 범위 재맞춤
  useEffect(() => { drawPath(); drawArrows(); fitToBounds() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry])

  // 선택 변경 → 마커 재생성(강조/약화) + 중앙 이동/확대 (해제 시 전체 복귀)
  useEffect(() => {
    const map = mapRef.current
    const valid = validRef.current
    renderMarkers()
    paintPath(selectedIndex != null && !preview)   // 선택 시 전체 경로 흐리게
    paintFocus(selectedIndex)                       // 선택+이전·다음 사이 구간만 선명
    if (!didSelectRef.current) { didSelectRef.current = true; return }
    if (!map) return
    const K = window.kakao.maps
    if (selectedIndex != null && valid[selectedIndex]) {
      const s = valid[selectedIndex]
      const pos = new K.LatLng(s.lat, s.lng)
      if (preview) { map.panTo(pos); return }
      // 이전·다음 스팟이 함께 보이도록 세 지점에 맞춤(하나로 확 당기지 않음)
      const total = valid.length
      const ks = Array.from(new Set([Math.max(0, selectedIndex - 1), selectedIndex, Math.min(total - 1, selectedIndex + 1)]))
      const pts = ks.map(k => valid[k]).filter(Boolean)
      const uniq = new Set(pts.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`))
      try {
        if (uniq.size <= 1) { map.setCenter(pos); map.setLevel(4, { anchor: pos, animate: { duration: 300 } }) }
        else { const b = new K.LatLngBounds(); pts.forEach(p => b.extend(new K.LatLng(p.lat, p.lng))); map.setBounds(b, 90, 90, 90, 90) }
      } catch { map.panTo(pos) }
    } else if (!preview) {
      fitToBounds()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
