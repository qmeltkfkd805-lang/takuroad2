/* 위치 검증 — 순수 함수(부작용 없음). Route Handler가 아니라 여기서 판정 로직을 관리.
   원본 좌표는 저장하지 않고, 누적 카운터/타임스탬프만 세션 방문 레코드에 유지한다. */
import type { LatLng, VerifyConfig, VerificationMode } from './types'

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export interface Ping { lat: number; lng: number; accuracy: number; at: number }  // at: epoch ms

export interface CheckpointState {
  key: string
  kind: 'building' | 'shop'
  lat: number
  lng: number
  status: string              // 'pending'이 아닌 것은 판정 대상 제외
  sampleCount: number
  inRangeSince: number | null // epoch ms
}

export interface PrevVerified { lat: number; lng: number; at: number }

export interface Promotion { key: string; distanceM: number; accuracyM: number; mode: VerificationMode }
export interface SampleUpdate { key: string; sampleCount: number; inRangeSince: number | null }
export interface PingDecision { promotions: Promotion[]; sampleUpdates: SampleUpdate[]; riskFlags: string[] }

/** 한 번의 ping 을 평가해 승격/누적갱신/위험신호를 결정. DB 반영은 호출부(서버)가 수행. */
export function evaluatePing(
  ping: Ping,
  checkpoints: CheckpointState[],
  cfg: VerifyConfig,
  prevVerified: PrevVerified | null,
): PingDecision {
  const promotions: Promotion[] = []
  const sampleUpdates: SampleUpdate[] = []
  const riskFlags: string[] = []

  // 정확도가 너무 낮은 ping 은 누적/승격에 쓰지 않음(보수적)
  if (!Number.isFinite(ping.accuracy) || ping.accuracy > cfg.accuracyMaxM) {
    return { promotions, sampleUpdates, riskFlags: ['low_accuracy'] }
  }

  for (const cp of checkpoints) {
    if (cp.status !== 'pending') continue
    const dist = haversineM(ping, cp)
    const inRange = dist <= cfg.checkpointRadiusM

    if (!inRange) {
      // 범위 이탈 → 연속 누적 리셋
      if (cp.sampleCount > 0 || cp.inRangeSince != null) sampleUpdates.push({ key: cp.key, sampleCount: 0, inRangeSince: null })
      continue
    }

    const sampleCount = cp.sampleCount + 1
    const inRangeSince = cp.inRangeSince ?? ping.at
    const dwellSec = (ping.at - inRangeSince) / 1000
    const canPromote = sampleCount >= cfg.minSamples || dwellSec >= cfg.minDwellSec

    if (canPromote) {
      // 이동 가능성 검사 — 직전 확인지점에서 현재까지 현실적 속도인지
      let reachable = true
      if (prevVerified) {
        const segM = haversineM(prevVerified, cp)
        const hours = Math.max((ping.at - prevVerified.at) / 3_600_000, 1e-9)
        const speedKmh = (segM / 1000) / hours
        if (speedKmh > cfg.maxSpeedKmh) { reachable = false; riskFlags.push(`impossible_speed:${cp.key}`) }
      }
      if (reachable) {
        promotions.push({
          key: cp.key,
          distanceM: Math.round(dist),
          accuracyM: Math.round(ping.accuracy),
          mode: cp.kind === 'building' ? 'building' : 'geo',
        })
      }
    }
    sampleUpdates.push({ key: cp.key, sampleCount, inRangeSince })
  }

  return { promotions, sampleUpdates, riskFlags }
}
