/* Storage 정리 워커 — 순수 로직. Route Handler 는 이 함수를 부르기만 한다.
 *
 * 큐 테이블은 exhibit_storage_cleanup_queue 를 그대로 쓴다.
 * 이름은 exhibit 전용이지만 스키마는 범용이다(bucket_id · object_path · reason · status …).
 * rename 은 cron 경로·기존 함수와의 결합 때문에 별도 작업으로 미뤘다.
 *
 * 삭제 안전 원칙
 *   · remove() 직전에 전 출처 참조 스냅샷을 다시 만든다. shop_images 하나만 보지 않는다
 *   · 참조 조회·파싱이 실패하면 그 청크는 remove 를 부르지 않고 pending 으로 되돌린다
 *   · "검사 자체가 불완전함" 과 "참조가 실제 확인됨" 을 구분한다
 *   · suffix LIKE 를 쓰지 않는다. canonical {bucket, path} 완전 일치만 참조로 본다
 */

import {
  buildReferenceSnapshot, isReferenced, type SelectAllFn,
} from './canonicalRef'

export const BATCH = 50
export const MAX_ATTEMPTS = 5
export const LEASE_MIN = 5
export const REMOVE_CHUNK = 100
export const PURGE_DAYS = 30
export const ALLOWED_BUCKETS = new Set(['exhibit-images', 'shop-images'])

export interface QueueRow {
  id: number
  bucket_id: string
  object_path: string
  attempts: number
}

export interface QueueStore {
  listClaimable(limit: number, maxAttempts: number, nowIso: string): Promise<{ id: number }[]>
  claim(ids: number[], nowIso: string, leaseIso: string): Promise<QueueRow[]>
  markDone(ids: number[], doneIso: string): Promise<void>
  /** 참조가 실제로 확인된 경우. attempts 는 올리지 않는다. */
  markBlocked(id: number, message: string): Promise<void>
  /** remove 실패. attempts 를 올리고 MAX 도달 시 failed 로 격리한다. */
  markFailure(id: number, attempts: number, status: 'pending' | 'failed', message: string): Promise<void>
  /** 검사 자체가 불완전해 손대지 못한 경우. pending 복귀 + lease 해제. attempts 유지. */
  release(ids: number[]): Promise<void>
  purge(cutoffIso: string): Promise<number>
}

export interface WorkerDeps {
  selectAll: SelectAllFn
  queue: QueueStore
  removeObjects: (bucket: string, paths: string[]) => Promise<void>
  supabaseHost: string
  now: () => Date
}

export interface WorkerResult {
  claimed: number
  deleted: number
  blocked: number
  failed: number
  /** 참조 검사가 불완전해 이번에 손대지 않고 되돌린 건수 */
  referenceCheckFailed: number
  purged: number
}

function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return true
  }
  return false
}

/** 큐 행이 오염돼도 엉뚱한 것을 지우지 않도록 경로 모양을 검사한다. */
export function isSanePath(bucket: string, p: string): boolean {
  if (typeof p !== 'string') return false
  const v = p.trim()
  if (v === '' || v !== p) return false
  if (v.startsWith('/')) return false
  if (v.includes('://')) return false
  if (v.includes('\\')) return false
  if (hasControlChar(v)) return false
  if (v.startsWith(`${bucket}/`)) return false
  return !v.split('/').some(s => s === '' || s === '.' || s === '..')
}

export async function runCleanup(deps: WorkerDeps): Promise<WorkerResult> {
  const { queue } = deps
  const now = deps.now()
  const nowIso = now.toISOString()
  const leaseIso = new Date(now.getTime() + LEASE_MIN * 60_000).toISOString()
  const cutoffIso = new Date(now.getTime() - PURGE_DAYS * 24 * 60 * 60_000).toISOString()

  const result: WorkerResult = {
    claimed: 0, deleted: 0, blocked: 0, failed: 0, referenceCheckFailed: 0, purged: 0,
  }

  const cands = await queue.listClaimable(BATCH, MAX_ATTEMPTS, nowIso)
  const ids = cands.map(c => c.id)
  if (!ids.length) {
    result.purged = await queue.purge(cutoffIso)
    return result
  }

  const rows = await queue.claim(ids, nowIso, leaseIso)
  result.claimed = rows.length
  if (!rows.length) {
    result.purged = await queue.purge(cutoffIso)
    return result
  }

  // 허용되지 않은 버킷 · 이상한 경로는 remove 를 부르지 않고 즉시 격리한다.
  const usable: QueueRow[] = []
  for (const r of rows) {
    if (!r.bucket_id || !ALLOWED_BUCKETS.has(r.bucket_id)) {
      await queue.markFailure(r.id, r.attempts ?? 0, 'failed', `허용되지 않은 대상: ${r.bucket_id}`)
      result.failed++
    } else if (!isSanePath(r.bucket_id, r.object_path ?? '')) {
      await queue.markFailure(r.id, r.attempts ?? 0, 'failed', 'malformed object path')
      result.failed++
    } else {
      usable.push(r)
    }
  }

  // 버킷별 → 청크별 처리
  const byBucket = new Map<string, QueueRow[]>()
  for (const r of usable) {
    const arr = byBucket.get(r.bucket_id) ?? []
    arr.push(r)
    byBucket.set(r.bucket_id, arr)
  }

  for (const [bucket, group] of byBucket) {
    for (let i = 0; i < group.length; i += REMOVE_CHUNK) {
      const chunk = group.slice(i, i + REMOVE_CHUNK)

      // ── remove() 직전, 전 출처 참조 스냅샷 ──
      let snap
      try {
        snap = await buildReferenceSnapshot(deps.selectAll, deps.supabaseHost)
      } catch {
        // 조회 실패 = 검사 불완전. 삭제하지 않고 되돌린다. attempts 증가 없음.
        await queue.release(chunk.map(r => r.id))
        result.referenceCheckFailed += chunk.length
        continue
      }

      if (snap.unparseable > 0) {
        // 내부 Storage URL 로 보이는데 해석 실패한 값이 있다.
        // 그 값이 이 청크를 가리키는지 판정할 수 없으므로 삭제하지 않는다.
        // 다만 영구 격리하지 않고 pending 으로 되돌린다 — 무관한 값 하나가
        // 전체 정리를 영구 정지시키면 안 된다.
        await queue.release(chunk.map(r => r.id))
        result.referenceCheckFailed += chunk.length
        continue
      }

      const held: QueueRow[] = []
      const go: QueueRow[] = []
      for (const r of chunk) {
        if (isReferenced(snap, bucket, r.object_path)) held.push(r)
        else go.push(r)
      }

      for (const r of held) {
        await queue.markBlocked(r.id, 'blocked: still referenced')
        result.blocked++
      }

      if (!go.length) continue

      try {
        await deps.removeObjects(bucket, go.map(r => r.object_path))
        // 이미 없는 객체도 성공으로 취급한다(멱등). 목표는 "남아있지 않은 상태"다.
        await queue.markDone(go.map(r => r.id), deps.now().toISOString())
        result.deleted += go.length
      } catch (e) {
        const message = String((e as { message?: unknown })?.message ?? e ?? '삭제 실패').slice(0, 500)
        for (const r of go) {
          const attempts = (r.attempts ?? 0) + 1
          await queue.markFailure(r.id, attempts, attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', message)
          result.failed++
        }
      }
    }
  }

  result.purged = await queue.purge(cutoffIso)
  return result
}
