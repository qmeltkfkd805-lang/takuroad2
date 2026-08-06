'use client'

/* 루트 지도 썸네일 — 카드에 '실제' 카카오 지도(비인터랙티브)를 얹는다.
   · 앱이 전역 로드하는 카카오 SDK(loadMaps)를 그대로 사용 → 추가 키·과금 없음
   · 드래그·줌 비활성 + pointer-events 차단 → 정적 이미지처럼 동작(카드 탭이 상세로 이동)
   · 샵 좌표를 핑크 경로선(Polyline)으로 잇고 번호 마커(CustomOverlay) 표시
   · 화면에 들어올 때만 초기화(IntersectionObserver, lazy)
   좌표가 없으면 가벼운 placeholder. */

import { useEffect, useRef, useState } from 'react'
import { loadMaps } from '@/lib/map/provider'

type Stop = { lat: number; lng: number }

export default function RouteMapThumb({ stops, height = 118 }: { stops: Stop[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  const pts = (stops ?? []).filter(s => typeof s?.lat === 'number' && typeof s?.lng === 'number')
  const coordsKey = pts.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')
  const hasCoords = pts.length > 0

  // 화면 근처에 들어오면 초기화 (lazy)
  useEffect(() => {
    if (!ref.current || !hasCoords) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setInView(true); io.disconnect() }
    }, { rootMargin: '250px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [hasCoords])

  // 실제 지도 생성
  useEffect(() => {
    if (!inView || !hasCoords || !ref.current) return
    let cancelled = false
    let cleanup: (() => void) | null = null
    loadMaps().then(() => {
      if (cancelled || !ref.current) return
      const kakao = (window as any).kakao
      if (!kakao?.maps) return
      const el = ref.current
      el.innerHTML = ''
      const list = coordsKey.split(';').map(s => { const [la, ln] = s.split(','); return { lat: +la, lng: +ln } })

      const map = new kakao.maps.Map(el, {
        center: new kakao.maps.LatLng(list[0].lat, list[0].lng),
        level: 5, draggable: false, zoomable: false,
      })
      try { map.setZoomable(false); map.setDraggable(false) } catch { /* noop */ }

      if (list.length > 1) {
        const bounds = new kakao.maps.LatLngBounds()
        list.forEach(p => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)))
        map.setBounds(bounds, 28, 28, 28, 28)
      } else {
        map.setLevel(4)
      }

      const objs: any[] = []
      if (list.length > 1) {
        const path = list.map(p => new kakao.maps.LatLng(p.lat, p.lng))
        const under = new kakao.maps.Polyline({ path, strokeWeight: 7, strokeColor: '#ffffff', strokeOpacity: 0.9, strokeStyle: 'solid' })
        under.setMap(map); objs.push(under)
        const line = new kakao.maps.Polyline({ path, strokeWeight: 4, strokeColor: '#e8006f', strokeOpacity: 0.95, strokeStyle: 'solid' })
        line.setMap(map); objs.push(line)
      }
      list.forEach((p, i) => {
        const node = document.createElement('div')
        node.style.cssText = 'width:22px;height:22px;border-radius:50%;background:#e8006f;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);color:#fff;font-weight:800;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center'
        node.textContent = String(i + 1)
        const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: node, yAnchor: 0.5, xAnchor: 0.5, zIndex: 3 })
        ov.setMap(map); objs.push(ov)
      })
      setTimeout(() => { try { map.relayout(); if (list.length > 1) { const b = new kakao.maps.LatLngBounds(); list.forEach(p => b.extend(new kakao.maps.LatLng(p.lat, p.lng))); map.setBounds(b, 28, 28, 28, 28) } } catch { /* noop */ } }, 60)

      cleanup = () => { objs.forEach(o => { try { o.setMap(null) } catch { /* noop */ } }) }
    })
    return () => { cancelled = true; if (cleanup) cleanup() }
  }, [inView, hasCoords, coordsKey])

  // 좌표 없음 → placeholder
  if (!hasCoords) {
    return (
      <div style={{ height, width: '100%', background: '#eef1f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#c3cad3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3z" /><path d="M9 7v13M15 4v13" />
        </svg>
      </div>
    )
  }

  return <div ref={ref} style={{ height, width: '100%', background: '#e9edf1', pointerEvents: 'none' }} />
}
