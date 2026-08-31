import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* 전시 스토리지 정리 워커 (크론 전용)
   GET|POST /api/exhibit/cleanup   헤더: Authorization: Bearer <CRON_SECRET>  (또는 x-cron-secret)

   DELETE 시 즉시 정리가 실패한 분(트리거가 exhibit_storage_cleanup_queue에 적재)을 처리한다.
   - pending + attempts < MAX + lease 만료된 행만 배치로 claim(lease_until 조건부 UPDATE = 행 단위 원자적)
   - 버킷은 화이트리스트만 허용(큐 행이 오염돼도 다른 버킷을 지우지 못하게)
   - 성공 → status='done', done_at 기록 / 실패 → attempts+1, MAX 도달 시 status='failed'
   - 마지막에 done_at이 PURGE_DAYS 지난 행 삭제 */

const BATCH = 50            // 한 번에 처리할 큐 행 수
const MAX_ATTEMPTS = 5      // 이 횟수 도달하면 status='failed'로 격리
const LEASE_MIN = 5         // claim 유지 시간(분)
const REMOVE_CHUNK = 100    // storage.remove 한 번에 보낼 경로 수
const PURGE_DAYS = 30       // done 행 보관 기간
const ALLOWED_BUCKETS = new Set(['exhibit-images'])

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const h = req.headers
  const bearer = h.get('authorization') ?? ''
  const given = bearer.toLowerCase().startsWith('bearer ')
    ? bearer.slice(7).trim()
    : (h.get('x-cron-secret') ?? '').trim()
  if (given.length !== secret.length) return false
  // 상수 시간 비교
  let diff = 0
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i)
  return diff === 0
}

async function run() {
  const svc = serviceClient()
  const nowIso = new Date().toISOString()
  const leaseIso = new Date(Date.now() + LEASE_MIN * 60_000).toISOString()
  const freeLease = `lease_until.is.null,lease_until.lt.${nowIso}`

  // 1) 후보 조회 (오래된 것부터)
  const { data: cands, error: selErr } = await svc.from('exhibit_storage_cleanup_queue')
    .select('id')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .or(freeLease)
    .order('created_at', { ascending: true })
    .limit(BATCH)
  if (selErr) throw new Error(selErr.message)

  const ids = (cands ?? []).map((r: any) => r.id)
  if (!ids.length) return { claimed: 0, deleted: 0, failed: 0, purged: await purge(svc) }

  // 2) claim — lease 조건을 UPDATE에 그대로 걸어 다른 워커와 겹치지 않게
  const { data: claimed, error: claimErr } = await svc.from('exhibit_storage_cleanup_queue')
    .update({ claimed_at: nowIso, lease_until: leaseIso })
    .in('id', ids)
    .eq('status', 'pending')
    .or(freeLease)
    .select('id, bucket_id, object_path, attempts')
  if (claimErr) throw new Error(claimErr.message)

  const rows = (claimed ?? []) as { id: number; bucket_id: string; object_path: string; attempts: number }[]
  if (!rows.length) return { claimed: 0, deleted: 0, failed: 0, purged: await purge(svc) }

  const okIds: number[] = []
  const failures: { row: typeof rows[number]; message: string }[] = []

  // 3) 허용되지 않은 버킷은 바로 실패 처리
  const usable: typeof rows = []
  for (const r of rows) {
    if (!r.bucket_id || !ALLOWED_BUCKETS.has(r.bucket_id) || !r.object_path) {
      failures.push({ row: r, message: `허용되지 않은 대상: ${r.bucket_id}` })
    } else usable.push(r)
  }

  // 4) 버킷별로 묶어서 삭제
  const byBucket = new Map<string, typeof rows>()
  for (const r of usable) {
    const arr = byBucket.get(r.bucket_id) ?? []
    arr.push(r)
    byBucket.set(r.bucket_id, arr)
  }
  for (const [bucket, group] of byBucket) {
    for (let i = 0; i < group.length; i += REMOVE_CHUNK) {
      const chunk = group.slice(i, i + REMOVE_CHUNK)
      try {
        const { error } = await svc.storage.from(bucket).remove(chunk.map(r => r.object_path))
        if (error) throw error
        // 이미 없는 객체도 성공으로 취급(멱등) — 목표는 "남아있지 않은 상태"
        okIds.push(...chunk.map(r => r.id))
      } catch (e: any) {
        const message = String(e?.message ?? e ?? '삭제 실패').slice(0, 500)
        for (const r of chunk) failures.push({ row: r, message })
      }
    }
  }

  // 5) 결과 반영
  if (okIds.length) {
    await svc.from('exhibit_storage_cleanup_queue')
      .update({ status: 'done', done_at: new Date().toISOString(), lease_until: null, last_error: null })
      .in('id', okIds)
  }
  for (const f of failures) {
    const attempts = (f.row.attempts ?? 0) + 1
    await svc.from('exhibit_storage_cleanup_queue')
      .update({
        attempts,
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        lease_until: null,
        last_error: f.message,
      })
      .eq('id', f.row.id)
  }

  return { claimed: rows.length, deleted: okIds.length, failed: failures.length, purged: await purge(svc) }
}

/* done 상태로 PURGE_DAYS 지난 행 정리 */
async function purge(svc: ReturnType<typeof serviceClient>): Promise<number> {
  const cutoff = new Date(Date.now() - PURGE_DAYS * 24 * 60 * 60_000).toISOString()
  const { data } = await svc.from('exhibit_storage_cleanup_queue')
    .delete()
    .eq('status', 'done')
    .lt('done_at', cutoff)
    .select('id')
  return (data ?? []).length
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const result = await run()
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[exhibit cleanup]', e?.message ?? e)
    return NextResponse.json({ ok: false, error: e?.message ?? 'cleanup failed' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
