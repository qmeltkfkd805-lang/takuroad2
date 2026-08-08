/* 『루트 방문하기』 공용 타입 */

export type VisitStatus =
  | 'pending'
  | 'proximity_verified'
  | 'checkpoint_verified'
  | 'qr_verified'
  | 'manual_recorded'
  | 'skipped'

export type VerificationMode = 'geo' | 'building' | 'manual' | 'qr'

export type SessionStatus =
  | 'active' | 'paused' | 'ended_completed' | 'ended_partial' | 'abandoned'

export type CompletionConfidence = 'high' | 'medium' | 'recorded'

export interface LatLng { lat: number; lng: number }

export interface OrderedStop {
  shopId: string
  lat: number
  lng: number
  placeId: string | null
}

/** 세션 시작 시 확정되어 저장되는 체크포인트 스냅샷 */
export interface Checkpoint {
  key: string                 // place:{placeId}:seq:{n} | shop:{shopId}
  kind: 'building' | 'shop'
  placeId: string | null
  seq: number                 // 같은 place 재방문 구분(1-based)
  lat: number
  lng: number
  shopIds: string[]           // 이 체크포인트에 묶인 샵들(건물 내부 샵 포함)
}

export interface VerifyConfig {
  checkpointRadiusM: number
  accuracyMaxM: number
  minSamples: number
  minDwellSec: number
  maxSpeedKmh: number
  sessionTtlHours: number
  fieldBonusRequiredRatio: number
  fieldBonusExp: number
  maxCheckpointCount: number
  minCheckpointDistanceM: number
}
