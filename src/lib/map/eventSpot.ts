/* 같은 장소에서 하는 이벤트 묶기 — 좌표를 소수점 4자리(약 10m)로 반올림한 값이 같으면 같은 장소.
   지도 핀(useMap)과 말풍선(MapPage)이 같은 기준을 써야 핀 하나 = 말풍선 한 묶음이 된다. */
export function eventSpotKey(ev: { lat?: number | null; lng?: number | null }): string | null {
  if (!ev.lat || !ev.lng) return null
  return `${Number(ev.lat).toFixed(4)},${Number(ev.lng).toFixed(4)}`
}
