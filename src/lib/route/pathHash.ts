import { createHash } from 'crypto'

export interface LatLng { lat: number; lng: number }

/** 좌표(방문순서 유지) + provider 로 안정적인 해시 생성.
 *  좌표나 순서가 바뀌면 해시가 달라져 재계산을 트리거한다.
 *  provider 를 포함해 제공자 교체 시에도 자동 무효화. */
export function waypointHash(ordered: LatLng[], provider = 'ors-foot-walking'): string {
  const key = ordered.map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|')
  return createHash('sha1').update(`${provider}:${key}`).digest('hex')
}
