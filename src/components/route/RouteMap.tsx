'use client'

import { useRef, useEffect, useState } from 'react'

declare global {
  interface Window { kakao: any }
}

const ROUTE_COLORS = ['#e8006f', '#ff6600', '#f5c400', '#16a34a', '#0099cc', '#1e3a8a', '#7c3aed']

interface RouteMapShop {
  id: string
  name: string
  lat: number
  lng: number
}

interface Props {
  shops: RouteMapShop[]
}

export default function RouteMap({ shops }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    function initMap() {
      if (!window.kakao || !window.kakao.maps) {
        setTimeout(initMap, 100)
        return
      }
      if (!containerRef.current) return

      window.kakao.maps.load(() => {
        if (!containerRef.current) return
        const validShops = shops.filter(s => s.lat && s.lng)
        if (validShops.length === 0) return

        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(validShops[0].lat, validShops[0].lng),
          level: 6,
        })

        // 번호 마커
        validShops.forEach((shop, i) => {
          const el = document.createElement('div')
          el.style.cssText = [
            `width:28px`, `height:28px`, `border-radius:50%`,
            `background:${ROUTE_COLORS[i % ROUTE_COLORS.length]}`,
            `color:#fff`, `display:flex`, `align-items:center`, `justify-content:center`,
            `font-size:13px`, `font-weight:900`, `box-shadow:0 2px 8px rgba(0,0,0,.3)`,
          ].join(';')
          el.textContent = String(i + 1)

          new window.kakao.maps.CustomOverlay({
            position: new window.kakao.maps.LatLng(shop.lat, shop.lng),
            content: el,
            yAnchor: 1.5,
            map,
          })
        })

        // 경로 선
        const path = validShops.map(s => new window.kakao.maps.LatLng(s.lat, s.lng))
        const polyline = new window.kakao.maps.Polyline({
          path,
          strokeWeight: 3,
          strokeColor: '#7c3aed',
          strokeOpacity: 0.8,
          strokeStyle: 'dashed',
        })
        polyline.setMap(map)

        // 전체 보이도록 범위 조정
        const bounds = new window.kakao.maps.LatLngBounds()
        validShops.forEach(s => bounds.extend(new window.kakao.maps.LatLng(s.lat, s.lng)))
        map.setBounds(bounds)

        setIsLoaded(true)
      })
    }

    initMap()
  }, [shops])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}