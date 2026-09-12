import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { env } from '@/lib/env'
import type { SelectAllFn } from '@/lib/storage/canonicalRef'
import {
  runCleanup, BATCH, MAX_ATTEMPTS, PURGE_DAYS,
  type QueueRow, type QueueStore,
} from '@/lib/storage/cleanupWorker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* Storage 정리 워커 (크론 전용)
   GET|POST /api/exhibit/cleanup   헤더: Authorization: Bearer <CRON_SECRET>  (또는 x-cron-secret)

   경로 이름은 exhibit 시절 그대로다. vercel.json 의 cron 이 이 경로를 부르므로 바꾸지 않는다.
   실제로는 exhibit-images 와 shop-images 를 함께 처리한다.

   Next.js 16 문서 확인 (node_modules/next/dist/docs)
     01-app/01-getting-started/15-route-handlers.md
       · Route Handler 는 기본적으로 캐시되지 않는다. GET 만 opt-in 대상이며
         이 라우트는 force-dynamic 이라 해당 없다
     01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md
       · runtime 은 'nodejs' | 'edge' 이고 'nodejs' 가 기본값이다. 유효한 옵션이다
       · edge 는 Cache Components 비지원 — 여기서는 nodejs 를 유지한다

   구체적인 삭제 규칙과 안전 원칙은 lib/storage/cleanupWorker.ts 참고. */

/** 한 번에 가져올 행 수와 전체 상한. 상한을 넘기면 조용히 덜 훑지 않고 실패시킨다. */
const PAGE = 1000
const ROW_CAP = 50_000

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

const QUEUE = 'exhibit_storage_cleanup_queue'

/* Next.js 16 은 route 파일의 export 를 핸들러·세그먼트 설정으로 제한한다.
   (.next/types 검증에서 TS2344 로 걸린다) 그래서 export 하지 않는다. */
async function buildDeps() {
  const svc = serviceClient()
  const supabaseHost = new URL(env.supabase.url).host

  /* PostgREST 는 기본 페이지 크기가 있으므로 range 로 끝까지 읽는다.
     한 페이지만 읽고 끝내면 참조를 놓쳐 오삭제로 이어진다. */
  const selectAll: SelectAllFn = async (table, columns) => {
    const out: Record<string, unknown>[] = []
    for (let from = 0; ; from += PAGE) {
      if (from >= ROW_CAP) throw new Error(`row cap exceeded: ${table}`)
      const { data, error } = await svc.from(table)
        .select(columns.join(','))
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`${table}: ${error.message}`)
      const rows = (data ?? []) as unknown as Record<string, unknown>[]
      out.push(...rows)
      if (rows.length < PAGE) break
    }
    return out
  }

  const freeLease = (nowIso: string) => `lease_until.is.null,lease_until.lt.${nowIso}`

  const queue: QueueStore = {
    async listClaimable(limit, maxAttempts, nowIso) {
      const { data, error } = await svc.from(QUEUE)
        .select('id')
        .eq('status', 'pending')
        .lt('attempts', maxAttempts)
        .or(freeLease(nowIso))
        .order('created_at', { ascending: true })
        .limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as { id: number }[]
    },
    async claim(ids, nowIso, leaseIso) {
      const { data, error } = await svc.from(QUEUE)
        .update({ claimed_at: nowIso, lease_until: leaseIso })
        .in('id', ids)
        .eq('status', 'pending')
        .or(freeLease(nowIso))
        .select('id, bucket_id, object_path, attempts')
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as QueueRow[]
    },
    async markDone(ids, doneIso) {
      if (!ids.length) return
      await svc.from(QUEUE)
        .update({ status: 'done', done_at: doneIso, lease_until: null, last_error: null })
        .in('id', ids)
    },
    async markBlocked(id, message) {
      // 참조가 실제로 확인된 경우. attempts 는 올리지 않는다.
      // status 에 blocked 값이 없으므로 failed + last_error 접두어로 구분한다.
      // 자동 재처리되지 않는다. 운영자가 별도로 재검사·재큐잉해야 한다.
      await svc.from(QUEUE)
        .update({ status: 'failed', lease_until: null, last_error: message.slice(0, 500) })
        .eq('id', id)
    },
    async markFailure(id, attempts, status, message) {
      await svc.from(QUEUE)
        .update({ attempts, status, lease_until: null, last_error: message.slice(0, 500) })
        .eq('id', id)
    },
    async release(ids) {
      // 검사가 불완전해 손대지 못한 경우. pending 복귀 + lease 해제. attempts 유지.
      if (!ids.length) return
      await svc.from(QUEUE)
        .update({ status: 'pending', lease_until: null, claimed_at: null })
        .in('id', ids)
    },
    async purge(cutoffIso) {
      const { data } = await svc.from(QUEUE)
        .delete()
        .eq('status', 'done')
        .lt('done_at', cutoffIso)
        .select('id')
      return (data ?? []).length
    },
  }

  const removeObjects = async (bucket: string, paths: string[]) => {
    const { error } = await svc.storage.from(bucket).remove(paths)
    if (error) throw error
  }

  return { selectAll, queue, removeObjects, supabaseHost, now: () => new Date() }
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const result = await runCleanup(await buildDeps())
    return NextResponse.json({ ok: true, batch: BATCH, maxAttempts: MAX_ATTEMPTS, purgeDays: PURGE_DAYS, ...result },
      { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    // 응답 전문·URL·키는 남기지 않는다
    const message = e instanceof Error ? e.message : 'cleanup failed'
    console.error('[storage cleanup]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
