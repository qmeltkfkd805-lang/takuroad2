'use client'
import { useEffect, useRef } from 'react'

declare global { interface Window { kakao: any } }

/**
 * 이벤트 장소 미니맵 — 핀 하나만 찍는다.
 * RouteMiniMap과 같은 방식(SDK 로드 대기 → 지도 생성).
 * 드래그·줌은 꺼서 페이지 스크롤을 방해하지 않는다.
 */
export default function EventMiniMap({
  lat, lng, name, height = 220,
}: {
  lat: number
  lng: number
  name: string
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    function init() {
      if (!window.kakao || !window.kakao.maps) { setTimeout(init, 100); return }
      window.kakao.maps.load(() => {
        if (!containerRef.current) return

        const center = new window.kakao.maps.LatLng(lat, lng)

        if (!mapRef.current) {
          mapRef.current = new window.kakao.maps.Map(containerRef.current, { center, level: 4 })
          mapRef.current.setDraggable(false)
          mapRef.current.setZoomable(false)
        } else {
          mapRef.current.setCenter(center)
        }

        // 핀 + 장소 이름
        new window.kakao.maps.CustomOverlay({
          map: mapRef.current,
          position: center,
          yAnchor: 1,
          content: `
            <div style="display:flex;align-items:center;gap:6px;transform:translateY(-6px);
                        background:#fff;border-radius:9999px;padding:6px 12px 6px 8px;
                        box-shadow:0 3px 12px rgba(0,0,0,.22);white-space:nowrap;">
              <span style="width:9px;height:9px;border-radius:9999px;background:#E8006F;flex-shrink:0"></span>
              <span style="font-size:12px;font-weight:700;color:#26262E;font-family:inherit">${name}</span>
            </div>`,
        })
      })
    }

    init()
  }, [lat, lng, name])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, borderRadius: 14, overflow: 'hidden', background: 'var(--surface2)' }}
    />
  )
}
