/* 검증 설정 — 안전 기본값 + 타입/범위 검증 + 파싱.
   실제 DB 조회는 서버에서 fetchVerifyConfig(client)로 하고 짧은 TTL 캐시. */
import type { VerifyConfig } from './types'

export const DEFAULT_CONFIG: VerifyConfig = {
  checkpointRadiusM: 100,
  accuracyMaxM: 80,
  minSamples: 2,
  minDwellSec: 20,
  maxSpeedKmh: 120,
  sessionTtlHours: 12,
  fieldBonusRequiredRatio: 0.6,
  fieldBonusExp: 5,
  maxCheckpointCount: 7,
  minCheckpointDistanceM: 150,
}

// 각 키의 허용 범위 [min, max]
const RANGES: Record<keyof VerifyConfig, [number, number]> = {
  checkpointRadiusM: [30, 500],
  accuracyMaxM: [10, 300],
  minSamples: [1, 10],
  minDwellSec: [0, 600],
  maxSpeedKmh: [10, 400],
  sessionTtlHours: [1, 72],
  fieldBonusRequiredRatio: [0, 1],
  fieldBonusExp: [0, 100],
  maxCheckpointCount: [2, 20],
  minCheckpointDistanceM: [0, 2000],
}

/** DB row(key/value) 배열 → 검증된 설정. 잘못된 값은 기본값으로 대체. */
export function parseConfigRows(rows: { key: string; value: any }[] | null | undefined): VerifyConfig {
  const out: VerifyConfig = { ...DEFAULT_CONFIG }
  const map = new Map((rows ?? []).map(r => [r.key, r.value]))
  ;(Object.keys(DEFAULT_CONFIG) as (keyof VerifyConfig)[]).forEach(k => {
    const raw = map.get(k)
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
    const [lo, hi] = RANGES[k]
    if (Number.isFinite(n) && n >= lo && n <= hi) out[k] = n
    // 범위 밖/누락 → 기본값 유지
  })
  return out
}

/** 클라이언트에 내려도 되는 비민감 값만 (UI 표시용). 판정은 서버가 DB값으로 수행. */
export function clientSafeConfig(cfg: VerifyConfig) {
  return {
    checkpointRadiusM: cfg.checkpointRadiusM,
    sessionTtlHours: cfg.sessionTtlHours,
  }
}
