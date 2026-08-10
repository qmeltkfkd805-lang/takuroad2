'use client'

/* 루트 지도 썸네일 — 카드에 '실제' 카카오 지도(비인터랙티브)를 얹는다.
   · 앱이 전역 로드하는 카카오 SDK(loadMaps)를 그대로 사용 → 추가 키·과금 없음
   · 드래그·줌 비활성 + pointer-events 차단 → 정적 이미지처럼 동작(카드 탭이 상세로 이동)
   · 샵 좌표를 핑크 경로선(Polyline)으로 잇고 번호 마커(CustomOverlay) 표시
   · 화면에 들어올 때만 초기화(IntersectionObserver, lazy)
   좌표가 없으면 가벼운 placeholder. */

import { useEffect, useRef, useState } from 'react'
import { loadMaps } from '@/lib/map/provider'
import { type RouteMapVariant } from '@/components/route/routeMeta'

type Stop = { lat: number; lng: number }

export default function RouteMapThumb({ stops, height = 118, labels, showEnds = false, variant = 'detail' }: { stops: Stop[]; height?: number; labels?: string[]; showEnds?: boolean; variant?: RouteMapVariant }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  const pts = (stops ?? []).filter(s => typeof s?.lat === 'number' && typeof s?.lng === 'number')
  const coordsKey = pts.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')
  const labelsKey = (labels ?? []).join('|') + (showEnds ? '#e' : '') + `#${variant}`
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

      // preview는 경로가 잘 보이도록 여백을 최소화해 최대한 확대
      const pad = variant === 'preview' ? 10 : 28
      if (list.length > 1) {
        const bounds = new kakao.maps.LatLngBounds()
        list.forEach(p => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)))
        map.setBounds(bounds, pad, pad, pad, pad)
      } else {
        map.setLevel(variant === 'preview' ? 3 : 4)
      }

      const objs: any[] = []
      if (list.length > 1) {
        const path = list.map(p => new kakao.maps.LatLng(p.lat, p.lng))
        const under = new kakao.maps.Polyline({ path, strokeWeight: 7, strokeColor: '#ffffff', strokeOpacity: 0.85, strokeStyle: 'solid' })
        under.setMap(map); objs.push(under)
        // 직선 연결선(실제 도보 경로 아님) → 점선으로 표기해 오해 방지
        const line = new kakao.maps.Polyline({ path, strokeWeight: 4, strokeColor: '#e8006f', strokeOpacity: 0.9, strokeStyle: 'shortdash' })
        line.setMap(map); objs.push(line)
      }
      if (variant === 'preview') {
        // 미니 미리보기: 번호·깃발 없이 출발·도착 텍스트 칩만 (경로선은 전체 유지)
        const makeDot = (filled: boolean) => {
          const div = document.createElement('div')
          div.style.cssText = `width:13px;height:13px;border-radius:9999px;box-sizing:border-box;background:${filled ? '#FF5692' : '#fff'};border:3px solid ${filled ? '#fff' : '#FF5692'};box-shadow:0 1px 3px rgba(0,0,0,.3);pointer-events:none`
          return div
        }
        const drawDot = (p: { lat: number; lng: number }, filled: boolean) => {
          const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: makeDot(filled), yAnchor: 0.5, xAnchor: 0.5, zIndex: 6 })
          ov.setMap(map); objs.push(ov)
        }
        drawDot(list[0], false)                                   // 출발: 속 빈 핑크 링
        if (list.length > 1) drawDot(list[list.length - 1], true) // 도착: 핑크 채움
      } else {
        // 지도 크기에 따라 핀 크기 조절 (작은 썸네일에선 작게)
        const pinSize = height < 90 ? 14 : height < 170 ? 16 : 22
        const pinFont = height < 90 ? 8.5 : height < 170 ? 9.5 : 11
        const pinPad = pinSize < 18 ? 2 : 6
        const pinBw = height < 90 ? 1.5 : 2
        list.forEach((p, i) => {
          const label = labels?.[i] ?? String(i + 1)
          const isFirst = i === 0, isLast = i === list.length - 1
          const wrap = document.createElement('div')
          wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center'
          const dot = document.createElement('div')
          dot.style.cssText = `min-width:${pinSize}px;height:${pinSize}px;padding:0 ${pinPad}px;box-sizing:border-box;border-radius:${pinSize / 2}px;background:#e8006f;border:${pinBw}px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);color:#fff;font-weight:800;font-size:${pinFont}px;line-height:1;display:flex;align-items:center;justify-content:center;white-space:nowrap`
          dot.textContent = label
          wrap.appendChild(dot)
          if (showEnds && list.length > 1 && (isFirst || isLast)) {
            const tag = document.createElement('div')
            tag.style.cssText = 'margin-top:2px;background:#fff;color:#e8006f;font-size:9px;font-weight:800;padding:1px 5px;border-radius:9999px;box-shadow:0 1px 2px rgba(0,0,0,.25);white-space:nowrap'
            tag.textContent = isFirst ? '출발' : '도착'
            wrap.appendChild(tag)
          }
          const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: wrap, yAnchor: 0.5, xAnchor: 0.5, zIndex: (isFirst || isLast) ? 5 : 3 })
          ov.setMap(map); objs.push(ov)
        })
      }
      // 컨테이너 실제 크기에 맞춰 전체 스팟이 항상 보이도록 범위 재조정
      const refit = () => {
        try {
          map.relayout()
          if (list.length > 1) {
            const b = new kakao.maps.LatLngBounds()
            list.forEach(p => b.extend(new kakao.maps.LatLng(p.lat, p.lng)))
            map.setBounds(b, pad, pad, pad, pad)
          } else {
            map.setLevel(variant === 'preview' ? 3 : 4); map.setCenter(new kakao.maps.LatLng(list[0].lat, list[0].lng))
          }
        } catch { /* noop */ }
      }
      setTimeout(refit, 60)
      let ro: ResizeObserver | null = null
      if (typeof ResizeObserver !== 'undefined' && el) { ro = new ResizeObserver(() => refit()); ro.observe(el) }

      cleanup = () => { objs.forEach(o => { try { o.setMap(null) } catch { /* noop */ } }); if (ro) ro.disconnect() }
    })
    return () => { cancelled = true; if (cleanup) cleanup() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasCoords, coordsKey, labelsKey])

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
