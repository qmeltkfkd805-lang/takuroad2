import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { env } from '@/lib/env'
import {
  buildReferenceSnapshot, isReferenced, refKey,
  REF_SOURCES, type SelectAllFn,
} from '@/lib/storage/canonicalRef'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ============================================================
   Storage 삭제 후보 조회 — 관리자 전용, 읽기 전용

   삭제 기능은 없다. 이 라우트는 숫자만 돌려준다.
   실제 삭제는 사람이 대시보드에서 확인하고 한다.

   참조 출처는 REF_SOURCES 한 곳에서만 온다
     이전 구현은 SQL 뷰에 참조 컬럼 목록을 따로 들고 있었다. 같은 목록이
     두 곳에 있으면 어긋난다 — 실제로 shop_images 의 버킷을 상수로 박고
     (REF_SOURCES 는 storage_bucket 컬럼을 읽는다), evidence_url 을 경로
     전용으로 다뤘으며(REF_SOURCES 는 urlOrPath), 외부 링크로 보이는
     컬럼 16개를 아예 빼먹었다. 전부 멀쩡한 파일을 삭제 후보로 만드는
     방향의 오류다. 이제 SQL 은 객체 나열만 하고 참조 지식은 갖지 않는다.

   0건과 검사 불가·잠정을 구분한다
     · 조회 실패      buildReferenceSnapshot 이 throw → 500. "참조 없음" 으로 바꾸지 않는다
     · 해석 실패      unparseable > 0 → complete:false, provisional:true.
                      후보 수는 잠정값이며 삭제 가능한 목록이 아니다
     · 행 잘림        수집 행 수와 total_count 가 다르면 실패시킨다.
                      잘린 목록으로 판정하면 살아 있는 파일이 후보가 된다

   증빙 경로는 응답에서 제외한다
     verify-documents 는 건수·용량만 낸다. sample 을 채우지 않고,
     서버 로그에도 경로를 남기지 않는다(에러는 message 만).
   ============================================================ */

/** 참조 조회 페이지 크기·상한. exhibit/cleanup 라우트와 같은 값을 쓴다. */
const PAGE = 1000
const ROW_CAP = 50_000

/** 객체 나열 페이지 크기·상한. SQL 함수 쪽 천장(200,000)보다 낮게 둔다. */
const INV_PAGE = 1000
const INV_MAX = 50_000

/** 경로를 응답에 싣지 않는 버킷 */
const PATH_SUPPRESSED = new Set(['verify-documents'])

/** 후보 경로를 버킷당 몇 개까지 보여줄지 */
const SAMPLE_LIMIT = 20

interface InvRow {
  bucket: string
  path: string
  bytes: number | string
  created: string
  total_count: number | string
}

interface BucketAgg {
  bucket: string
  objects: number
  bytes: number
  candidates: number
  candidateBytes: number
  heldRecent: number
  heldRecentBytes: number
  sample: { path: string; bytes: number; created: string }[]
}

/** 정렬된 키 목록의 md5. 두 구현의 결과가 "개수만 같은지 집합이 같은지" 를 가른다. */
function digest(keys: string[]): string {
  return createHash('md5').update(keys.slice().sort().join('\n')).digest('hex')
}

export async function GET(req: NextRequest) {
  // 1) 관리자 확인 — 서버에서. 화면의 판단을 믿지 않는다
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const { data: profile } = await userSupabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  /* 2) 판정 보류 기준 시간. 업로드 직후 아직 DB 에 연결되지 않은 객체가 있어서
        최근 생성분은 후보에서 빼고 따로 센다. 기본 24시간. */
  const rawHours = req.nextUrl.searchParams.get('hours')
  let hours = 24
  if (rawHours !== null) {
    const n = Number(rawHours)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'hours 는 0 이상의 숫자여야 해요' }, { status: 400 })
    }
    hours = Math.min(Math.floor(n), 24 * 90)
  }

  const svc = serviceClient()
  const supabaseHost = new URL(env.supabase.url).host

  try {
    /* 3) 참조 조회. exhibit/cleanup 라우트의 selectAll 과 같은 방식이다
          (한 페이지만 읽고 끝내면 참조를 놓쳐 오판으로 이어진다).
          공용으로 빼면 크론 경로를 건드려야 해서 이번에는 같은 코드를 둔다. */
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

    // 실패하면 throw 한다. 아래 catch 가 500 으로 돌려주고, 0건으로 바꾸지 않는다.
    const snap = await buildReferenceSnapshot(selectAll, supabaseHost)

    /* 4) 객체 나열. total_count 와 대조해 잘렸는지 확인한다. */
    const objects: InvRow[] = []
    let total: number | null = null
    for (let offset = 0; ; offset += INV_PAGE) {
      if (offset >= INV_MAX) throw new Error('inventory offset cap exceeded')
      const { data, error } = await svc.rpc('storage_object_inventory', {
        p_offset: offset, p_limit: INV_PAGE, p_max_rows: INV_MAX,
      })
      if (error) throw new Error(`inventory: ${error.message}`)
      const rows = (data ?? []) as unknown as InvRow[]
      if (total === null && rows.length > 0) total = Number(rows[0].total_count)
      objects.push(...rows)
      if (rows.length < INV_PAGE) break
    }
    if (total === null) total = 0
    if (objects.length !== total) {
      throw new Error(`inventory truncated: ${objects.length} of ${total}`)
    }
    // 페이지 경계가 겹쳐 같은 객체를 두 번 세지 않았는지
    const objKeys = objects.map(o => refKey(o.bucket, o.path))
    if (new Set(objKeys).size !== objects.length) {
      throw new Error('inventory returned duplicate keys')
    }

    /* 5) 판정. 해석 실패가 있으면 후보 수는 잠정값이다 — 참조가 있는데
          못 읽은 값이 있다는 뜻이라, 살아 있는 파일이 섞여 있을 수 있다. */
    const complete = snap.unparseable === 0
    const cutoff = Date.now() - hours * 3600_000

    const byBucket = new Map<string, BucketAgg>()
    const candidateKeys: string[] = []

    for (const o of objects) {
      const bytes = Number(o.bytes) || 0
      let agg = byBucket.get(o.bucket)
      if (!agg) {
        agg = {
          bucket: o.bucket, objects: 0, bytes: 0,
          candidates: 0, candidateBytes: 0,
          heldRecent: 0, heldRecentBytes: 0, sample: [],
        }
        byBucket.set(o.bucket, agg)
      }
      agg.objects++
      agg.bytes += bytes

      if (isReferenced(snap, o.bucket, o.path)) continue

      if (new Date(o.created).getTime() >= cutoff) {
        agg.heldRecent++
        agg.heldRecentBytes += bytes
        continue
      }

      agg.candidates++
      agg.candidateBytes += bytes
      candidateKeys.push(refKey(o.bucket, o.path))
      // 증빙 버킷은 경로를 응답에 싣지 않는다
      if (!PATH_SUPPRESSED.has(o.bucket)) {
        agg.sample.push({ path: o.path, bytes, created: o.created })
      }
    }

    const buckets = [...byBucket.values()]
      .map(b => ({
        bucket: b.bucket,
        objects: b.objects,
        bytes: b.bytes,
        candidates: b.candidates,
        candidateBytes: b.candidateBytes,
        heldRecent: b.heldRecent,
        heldRecentBytes: b.heldRecentBytes,
        pathsSuppressed: PATH_SUPPRESSED.has(b.bucket),
        sample: b.sample.sort((x, y) => y.bytes - x.bytes).slice(0, SAMPLE_LIMIT),
      }))
      .sort((a, b) => b.candidateBytes - a.candidateBytes || a.bucket.localeCompare(b.bucket))

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      recentHours: hours,

      /* 검사 완전성.
         complete=false 면 후보 수는 잠정값이며 "고아 0건" 으로도,
         삭제해도 되는 목록으로도 확정하면 안 된다. */
      complete,
      provisional: !complete,
      unparseableCount: snap.unparseable,
      // 출처와 사유만. 값 원문은 canonicalRef 가 애초에 담지 않는다
      unparseableSamples: snap.unparseableSamples,

      // 참조 쪽 규모 — 출처가 통째로 빠지면 여기 숫자가 먼저 움직인다
      sourceCount: REF_SOURCES.length,
      scannedValues: snap.scanned,
      referenceKeyCount: snap.keys.size,
      referenceKeyDigest: digest([...snap.keys]),
      candidateKeyDigest: digest(candidateKeys),
      // 집합이 어디서 어긋나는지 좁히기 위한 버킷별 지문
      referenceKeysByBucket: (() => {
        const m = new Map<string, string[]>()
        for (const k of snap.keys) {
          const b = k.slice(0, k.indexOf('/'))
          const arr = m.get(b)
          if (arr) arr.push(k)
          else m.set(b, [k])
        }
        return [...m.entries()]
          .map(([bucket, ks]) => ({ bucket, count: ks.length, digest: digest(ks) }))
          .sort((a, b) => a.bucket.localeCompare(b.bucket))
      })(),

      totals: {
        objects: objects.length,
        bytes: buckets.reduce((a, b) => a + b.bytes, 0),
        candidates: buckets.reduce((a, b) => a + b.candidates, 0),
        candidateBytes: buckets.reduce((a, b) => a + b.candidateBytes, 0),
        heldRecent: buckets.reduce((a, b) => a + b.heldRecent, 0),
        heldRecentBytes: buckets.reduce((a, b) => a + b.heldRecentBytes, 0),
      },

      buckets,
    })
  } catch (e) {
    // 경로·URL·키는 로그에도 남기지 않는다. message 만.
    const message = e instanceof Error ? e.message : '알 수 없는 오류'
    console.error('[storage-orphans]', message)
    return NextResponse.json(
      {
        error: '삭제 후보를 조회하지 못했어요',
        detail: message,
        complete: false,
        // 조회 실패는 "후보 0건" 이 아니다
        checkFailed: true,
      },
      { status: 500 },
    )
  }
}
