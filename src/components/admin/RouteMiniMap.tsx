'use client'
import { useRef, useEffect } from 'react'

declare global { interface Window { kakao: any } }

export interface RouteStop { id: string; lat: number; lng: number; name: string }

export default function RouteMiniMap({ stops }: { stops: RouteStop[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const polylineRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return
    function init() {
      if (!window.kakao || !window.kakao.maps) { setTimeout(init, 100); return }
      window.kakao.maps.load(() => {
        if (!containerRef.current || mapRef.current) return
        mapRef.current = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(37.5519, 127.0738),
          level: 6,
        })
        draw()
      })
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { draw() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [stops])

  function draw() {
    const map = mapRef.current
    if (!map || !window.kakao) return
    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null }
    if (stops.length === 0) return

    const path = stops.map((s) => new window.kakao.maps.LatLng(s.lat, s.lng))

    polylineRef.current = new window.kakao.maps.Polyline({
      path, strokeWeight: 3, strokeColor: '#e8006f', strokeOpacity: 0.8, strokeStyle: 'solid',
    })
    polylineRef.current.setMap(map)

    stops.forEach((s, i) => {
      const el = document.createElement('div')
      el.style.cssText = 'width:24px;height:24px;border-radius:9999px;background:#e8006f;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)'
      el.textContent = String(i + 1)
      const ov = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(s.lat, s.lng), content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 5,
      })
      ov.setMap(map)
      overlaysRef.current.push(ov)
    })

    const bounds = new window.kakao.maps.LatLngBounds()
    path.forEach((p: any) => bounds.extend(p))
    map.setBounds(bounds)
  }

  return <div ref={containerRef} style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }} />
}
