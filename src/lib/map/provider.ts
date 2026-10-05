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
  /** 이동·줌이 끝났을 때 (화면 밖 핀 숨기기 등) */
  addIdleListener(cb: () => void): void
  /** 지금 화면에 보이는 영역 */
  getBounds(): { swLat: number; swLng: number; neLat: number; neLng: number } | null
  getLevel(): number
  /** 지도 중심을 픽셀만큼 부드럽게 옮긴다 (dx 양수 = 중심이 오른쪽으로 → 내용은 왼쪽으로, dy 양수 = 중심이 아래로 → 내용은 위로) */
  panBy(dx: number, dy: number): void
  /** 좌표가 지도 화면 안에서 어디(px)에 있는지 */
  pointOf(lat: number, lng: number): { x: number; y: number } | null
  /** 지도 화면 크기(px) */
  getSize(): { w: number; h: number }
  raw: any
}

export interface OverlayHandle {
  remove(): void
  /** 지도에 다시 붙이기 / 떼기 (DOM 은 그대로 두고 재사용) */
  show(): void
  hide(): void
  readonly visible: boolean
  raw: any
}

export interface OverlayOptions {
  lat: number
  lng: number
  content: HTMLElement
  yAnchor?: number
  xAnchor?: number
  /** true 면 만들기만 하고 지도에는 아직 안 붙인다 (화면 밖) */
  hidden?: boolean
  zIndex?: number
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
    addIdleListener(cb) { window.kakao.maps.event.addListener(map, 'idle', cb) },
    getBounds() {
      try {
        const b = map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast()
        return { swLat: sw.getLat(), swLng: sw.getLng(), neLat: ne.getLat(), neLng: ne.getLng() }
      } catch { return null }
    },
    getLevel() { return map.getLevel() },
    panBy(dx, dy) { map.panBy(Math.round(dx), Math.round(dy)) },
    pointOf(lat, lng) {
      try {
        const p = map.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(lat, lng))
        return { x: p.x, y: p.y }
      } catch { return null }
    },
    getSize() { return { w: el.clientWidth, h: el.clientHeight } },
  }
}

export function createOverlay(map: MapInstance, opts: OverlayOptions): OverlayHandle {
  const overlay = new window.kakao.maps.CustomOverlay({
    position: new window.kakao.maps.LatLng(opts.lat, opts.lng),
    content: opts.content,
    yAnchor: opts.yAnchor ?? 1,
    ...(opts.xAnchor !== undefined ? { xAnchor: opts.xAnchor } : {}),
    ...(opts.zIndex !== undefined ? { zIndex: opts.zIndex } : {}),
  })
  let visible = opts.hidden ? false : true
  if (visible) overlay.setMap(map.raw)
  return {
    raw: overlay,
    remove() { visible = false; overlay.setMap(null) },
    show() { if (!visible) { visible = true; overlay.setMap(map.raw) } },
    hide() { if (visible) { visible = false; overlay.setMap(null) } },
    get visible() { return visible },
  }
}