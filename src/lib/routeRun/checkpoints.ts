/* 체크포인트 도출 — 순수 함수.
   · 고유 place_id 건물 그룹 기준. 연속 같은 건물은 하나로 묶고, 나중에 다시 온 같은 건물은
     루트 순서상 별개 방문으로 보고 place:{placeId}:seq:{n} 로 구분(재방문 손실 방지).
   · place_id 없는 외부 단독 샵은 shop:{shopId}.
   · 후보가 maxCheckpointCount 이하면 전부, 초과면 시작·끝 고정 + 누적 이동거리 균등 분산(최소거리 존중). */
import type { Checkpoint, OrderedStop, VerifyConfig } from './types'
import { haversineM } from './verification'

interface Cand { placeId: string | null; shopIds: string[]; lats: number[]; lngs: number[] }
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function deriveCheckpoints(stops: OrderedStop[], cfg: VerifyConfig): Checkpoint[] {
  const valid = stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
  if (valid.length === 0) return []

  // 1) 후보 생성 (연속 같은 건물만 병합)
  const cands: Cand[] = []
  for (const s of valid) {
    const last = cands[cands.length - 1]
    if (s.placeId && last && last.placeId === s.placeId) {
      last.shopIds.push(s.shopId); last.lats.push(s.lat); last.lngs.push(s.lng)
    } else {
      cands.push({ placeId: s.placeId ?? null, shopIds: [s.shopId], lats: [s.lat], lngs: [s.lng] })
    }
  }

  // 2) 체크포인트화 (재방문 seq 부여)
  const seqCounter = new Map<string, number>()
  const all: Checkpoint[] = cands.map(c => {
    const lat = avg(c.lats), lng = avg(c.lngs)
    if (c.placeId) {
      const n = (seqCounter.get(c.placeId) ?? 0) + 1
      seqCounter.set(c.placeId, n)
      return { key: `place:${c.placeId}:seq:${n}`, kind: 'building', placeId: c.placeId, seq: n, lat, lng, shopIds: c.shopIds }
    }
    return { key: `shop:${c.shopIds[0]}`, kind: 'shop', placeId: null, seq: 1, lat, lng, shopIds: c.shopIds }
  })

  const n = all.length
  if (n <= cfg.maxCheckpointCount) return all

  // 3) 초과 시: 시작·끝 고정 + 누적 이동거리 균등 + 최소거리
  const cum = [0]
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + haversineM(all[i - 1], all[i])
  const total = cum[n - 1] || 1

  const selected = new Set<number>([0, n - 1])
  const middleTargets = cfg.maxCheckpointCount - 2
  for (let k = 1; k <= middleTargets; k++) {
    const td = (total * k) / (cfg.maxCheckpointCount - 1)
    let best = -1, bestDiff = Infinity
    for (let i = 1; i < n - 1; i++) {
      if (selected.has(i)) continue
      let tooClose = false
      for (const j of selected) { if (haversineM(all[i], all[j]) < cfg.minCheckpointDistanceM) { tooClose = true; break } }
      if (tooClose) continue
      const diff = Math.abs(cum[i] - td)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    }
    if (best >= 0) selected.add(best)
  }

  return Array.from(selected).sort((a, b) => a - b).map(i => all[i])
}
