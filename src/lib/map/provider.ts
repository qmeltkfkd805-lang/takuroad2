// 지도 제공자 어댑터 — 현재는 카카오 지도를 감싼다.
// 나중에 구글/Mapbox로 바꾸려면 "이 파일만" 다시 구현하면 된다.
// (지오코딩/장소검색은 lib/utils/geocode.ts 가 담당 — 그것도 교체 대상)

declare global {
  interface Window { kakao: any }
}

export interface LatLng { lat: number; lng: number }

export interface MapInstance {
  setCenter(lat: number, lng: number): void
  setLevel(level: number): void
  getCenter(): LatLng
  relayout(): void
  addClickListener(cb: () => void): void
  raw: any
}

export interface OverlayHandle {
  remove(): void
  raw: any
}

export interface OverlayOptions {
  lat: number
  lng: number
  content: HTMLElement
  yAnchor?: number
  xAnchor?: number
}

// 지도 SDK가 준비될 때까지 기다린 뒤 resolve
export function loadMaps(): Promise<void> {
  return new Promise((resolve) => {
    function wait() {
      if (typeof window === 'undefined') return
      if (!window.kakao || !window.kakao.maps) {
        setTimeout(wait, 100)
        return
      }
      window.kakao.maps.load(() => resolve())
    }
    wait()
  })
}

export function createMap(el: HTMLElement, opts: { lat: number; lng: number; level: number }): MapInstance {
  const map = new window.kakao.maps.Map(el, {
    center: new window.kakao.maps.LatLng(opts.lat, opts.lng),
    level: opts.level,
  })
  return {
    raw: map,
    setCenter(lat, lng) { map.setCenter(new window.kakao.maps.LatLng(lat, lng)) },
    setLevel(level) { map.setLevel(level) },
    getCenter() { const c = map.getCenter(); return { lat: c.getLat(), lng: c.getLng() } },
    relayout() { map.relayout() },
    addClickListener(cb) { window.kakao.maps.event.addListener(map, 'click', cb) },
  }
}

export function createOverlay(map: MapInstance, opts: OverlayOptions): OverlayHandle {
  const overlay = new window.kakao.maps.CustomOverlay({
    position: new window.kakao.maps.LatLng(opts.lat, opts.lng),
    content: opts.content,
    yAnchor: opts.yAnchor ?? 1,
    ...(opts.xAnchor !== undefined ? { xAnchor: opts.xAnchor } : {}),
  })
  overlay.setMap(map.raw)
  return {
    raw: overlay,
    remove() { overlay.setMap(null) },
  }
}