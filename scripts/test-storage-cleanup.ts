/* Storage 정리 워커 · canonical 참조 파서 단위 테스트
 *
 *   npx tsx scripts/test-storage-cleanup.ts
 *
 * 저장소에 테스트 러너(vitest·jest)가 없어 tsx + 최소 assert 로 돌린다.
 * 서버 런타임 코드이므로 브라우저를 쓰지 않는다.
 * DB·Storage 는 전부 주입한 가짜다. 네트워크를 타지 않는다.
 */

import {
  parseUrlRef, parsePathRef, parseUrlOrPathRef,
  buildReferenceSnapshot, refKey,
  type RefSource, type SelectAllFn,
} from '../src/lib/storage/canonicalRef'
import {
  runCleanup, isSanePath, MAX_ATTEMPTS,
  type QueueRow, type QueueStore, type WorkerDeps,
} from '../src/lib/storage/cleanupWorker'

const HOST = 'ouhlwmtwgxewrktgrzkd.supabase.co'
const BASE = `https://${HOST}/storage/v1/object/public`

let pass = 0
const fails: string[] = []

function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`PASS  ${name}`) }
  else { fails.push(name); console.log(`FAIL  ${name}\n        got  ${g}\n        want ${w}`) }
}

async function main() {

/* ============================================================
 * 1. canonical URL 파서 경계
 * ============================================================ */
const ref = (bucket: string, path: string) => ({ kind: 'storage', bucket, path })
const ext = { kind: 'external' }
const unp = (why: string) => ({ kind: 'unparseable', why })

eq('public URL 기본',
  parseUrlRef(`${BASE}/shop-images/a/main/b.webp`, HOST), ref('shop-images', 'a/main/b.webp'))

eq('query string 제거',
  parseUrlRef(`${BASE}/shop-images/a/main/b.webp?width=200&t=1`, HOST), ref('shop-images', 'a/main/b.webp'))

eq('fragment 제거',
  parseUrlRef(`${BASE}/shop-images/a/main/b.webp#x`, HOST), ref('shop-images', 'a/main/b.webp'))

eq('signed URL',
  parseUrlRef(`https://${HOST}/storage/v1/object/sign/shop-images/a/b.webp?token=x`, HOST),
  ref('shop-images', 'a/b.webp'))

eq('render/image URL',
  parseUrlRef(`https://${HOST}/storage/v1/render/image/public/shop-images/a/b.webp?w=10`, HOST),
  ref('shop-images', 'a/b.webp'))

eq('%20 공백',
  parseUrlRef(`${BASE}/shop-images/a/my%20file.webp`, HOST), ref('shop-images', 'a/my file.webp'))

eq('+ 는 공백으로 바꾸지 않는다',
  parseUrlRef(`${BASE}/shop-images/a/my+file.webp`, HOST), ref('shop-images', 'a/my+file.webp'))

eq('Unicode 한글 파일명',
  parseUrlRef(`${BASE}/shop-images/a/${encodeURIComponent('사진.webp')}`, HOST),
  ref('shop-images', 'a/사진.webp'))

eq('%25 는 리터럴 %',
  parseUrlRef(`${BASE}/shop-images/a/100%25.webp`, HOST), ref('shop-images', 'a/100%.webp'))

eq('%2F 는 경계가 모호 → unparseable',
  parseUrlRef(`${BASE}/shop-images/a%2Fb/c.webp`, HOST), unp('path: ambiguous %2F inside segment'))

eq('bucket 세그먼트의 %2F → unparseable',
  parseUrlRef(`${BASE}/shop%2Fimages/a/b.webp`, HOST), unp('bucket: ambiguous %2F inside segment'))

eq('malformed percent → unparseable',
  parseUrlRef(`${BASE}/shop-images/a/%zz.webp`, HOST), unp('path: malformed percent-encoding'))

// new URL() 이 pathname 의 dot segment 를 먼저 정규화한다.
// HTTP 클라이언트와 Supabase 도 같은 규칙으로 해석하므로 b.webp 를 가리키는 참조가 맞다.
// 보호 대상이 하나 늘 뿐이라 방향이 안전하다.
eq('.. 는 URL 이 정규화 → 정규화된 경로를 참조로 본다',
  parseUrlRef(`${BASE}/shop-images/a/../b.webp`, HOST), ref('shop-images', 'b.webp'))

// WHATWG URL 은 %2E·%2e 도 dot 으로 보고 정규화한다. 인코딩해도 우회되지 않는다.
eq('%2E%2E 도 URL 이 정규화',
  parseUrlRef(`${BASE}/shop-images/a/%2E%2E/b.webp`, HOST), ref('shop-images', 'b.webp'))

// 빈 세그먼트(//)도 마찬가지로 URL 이 남긴다
eq('빈 세그먼트 → unparseable',
  parseUrlRef(`${BASE}/shop-images/a//b.webp`, HOST), unp('path: empty or dot segment'))

eq('외부 URL → external',
  parseUrlRef('https://example.com/img/a.webp', HOST), ext)

eq('다른 host 의 storage 모양 URL → unparseable',
  parseUrlRef('https://other.supabase.co/storage/v1/object/public/shop-images/a.webp', HOST),
  unp('storage-shaped URL on another host'))

eq('같은 host 인데 모양이 다름 → unparseable',
  parseUrlRef(`https://${HOST}/storage/v1/weird/shop-images/a.webp`, HOST),
  unp('unknown storage path shape'))

eq('같은 host 의 비 storage 경로 → external',
  parseUrlRef(`https://${HOST}/rest/v1/shops`, HOST), ext)

eq('bucket 만 있고 path 없음 → unparseable',
  parseUrlRef(`${BASE}/shop-images`, HOST), unp('missing bucket or object path'))

eq('빈 문자열 → external', parseUrlRef('   ', HOST), ext)

eq('앱 정적 자산 경로 → external',
  parseUrlRef('/badges/attendance.png', HOST), ext)

eq('앱 정적 자산 경로 + query → external',
  parseUrlRef('/backgrounds/bg-cafe.jpg?v=2', HOST), ext)

eq('bucket/path 로 보이는 비-URL 값 → unparseable(보수적)',
  parseUrlRef('shop-images/a/b.webp', HOST), unp('non-URL value in URL column'))

eq('URL 컬럼의 슬래시 없는 값 → external',
  parseUrlRef('none', HOST), ext)

// path 컬럼
eq('path 컬럼 기본', parsePathRef('shop-images', 'a/main/b.webp'), ref('shop-images', 'a/main/b.webp'))
eq('path 선행 슬래시 제거', parsePathRef('shop-images', '/a/b.webp'), ref('shop-images', 'a/b.webp'))
eq('path 컬럼은 decode 하지 않는다',
  parsePathRef('shop-images', 'a/my%20file.webp'), ref('shop-images', 'a/my%20file.webp'))
eq('path .. → unparseable',
  parsePathRef('shop-images', 'a/../b.webp'), unp('path: empty or dot segment'))
eq('bucket 없음 → unparseable', parsePathRef(null, 'a/b.webp'), unp('missing bucket'))

// url-or-path
eq('urlOrPath: URL 분기',
  parseUrlOrPathRef(`${BASE}/verify-documents/x.pdf`, 'verify-documents', HOST),
  ref('verify-documents', 'x.pdf'))
eq('urlOrPath: path 분기',
  parseUrlOrPathRef('a/x.pdf', 'verify-documents', HOST), ref('verify-documents', 'a/x.pdf'))

// 파일명만 같고 폴더가 다르면 불일치
eq('폴더가 다르면 다른 키',
  refKey('shop-images', 'a/main/x.webp') === refKey('shop-images', 'b/main/x.webp'), false)

/* ============================================================
 * 2. 참조 스냅샷
 * ============================================================ */
function fakeSelect(data: Record<string, Record<string, unknown>[]>): SelectAllFn {
  return async (table) => data[table] ?? []
}

const SRC_SUBSET: RefSource[] = [
  { kind: 'url', table: 'shop_images', column: 'image_url' },
  { kind: 'pathWithBucketColumn', table: 'shop_images', column: 'storage_path', bucketColumn: 'storage_bucket' },
  { kind: 'url', table: 'shop_highlights', column: 'image_url' },
  { kind: 'jsonArray', table: 'community_posts', column: 'images' },
  { kind: 'textArray', table: 'contact_messages', column: 'attachment_urls' },
]

{
  const snap = await buildReferenceSnapshot(fakeSelect({
    shop_images: [{ image_url: `${BASE}/shop-images/s/main/1.webp`, storage_path: 's/main/1.webp', storage_bucket: 'shop-images' }],
    shop_highlights: [{ image_url: `${BASE}/shop-images/s/highlights/2.jpg` }],
    community_posts: [{ images: [`${BASE}/shop-images/community/u/3.jpg`, 'https://x.com/a.jpg'] }],
    contact_messages: [{ attachment_urls: [`${BASE}/shop-images/community/u/4.jpg`] }],
  }), HOST, SRC_SUBSET)

  eq('스냅샷 키 수', snap.keys.size, 4)
  eq('스냅샷 unparseable 0', snap.unparseable, 0)
  eq('shop_images URL 과 path 가 같은 키로 합쳐짐', snap.keys.has(refKey('shop-images', 's/main/1.webp')), true)
  eq('highlights 참조 포함', snap.keys.has(refKey('shop-images', 's/highlights/2.jpg')), true)
  eq('외부 URL 은 키에 없음', snap.keys.has(refKey('shop-images', 'a.jpg')), false)
}

{
  const snap = await buildReferenceSnapshot(fakeSelect({
    shop_images: [{ image_url: `${BASE}/shop-images/a%2Fb/c.webp` }],
  }), HOST, [{ kind: 'url', table: 'shop_images', column: 'image_url' }])
  eq('unparseable 집계', snap.unparseable, 1)
  eq('unparseable 샘플에 원문 없음', Object.keys(snap.unparseableSamples[0]).sort(), ['source', 'why'])
}

/* ============================================================
 * 3. 워커 — 전부 가짜 의존성
 * ============================================================ */
interface Recorded {
  removed: { bucket: string; paths: string[] }[]
  done: number[][]
  blocked: { id: number; message: string }[]
  failure: { id: number; attempts: number; status: string; message: string }[]
  released: number[][]
}

function makeDeps(opts: {
  rows: QueueRow[]
  refs?: Record<string, Record<string, unknown>[]>
  selectThrows?: boolean
  removeThrows?: boolean
  sources?: RefSource[]
}): { deps: WorkerDeps; rec: Recorded } {
  const rec: Recorded = { removed: [], done: [], blocked: [], failure: [], released: [] }

  const queue: QueueStore = {
    async listClaimable() { return opts.rows.map(r => ({ id: r.id })) },
    async claim() { return opts.rows },
    async markDone(ids) { rec.done.push(ids) },
    async markBlocked(id, message) { rec.blocked.push({ id, message }) },
    async markFailure(id, attempts, status, message) { rec.failure.push({ id, attempts, status, message }) },
    async release(ids) { rec.released.push(ids) },
    async purge() { return 0 },
  }

  const selectAll: SelectAllFn = async (table) => {
    if (opts.selectThrows) throw new Error('db down')
    return opts.refs?.[table] ?? []
  }

  const deps: WorkerDeps = {
    selectAll, queue, supabaseHost: HOST, now: () => new Date('2026-09-12T00:00:00Z'),
    removeObjects: async (bucket, paths) => {
      if (opts.removeThrows) throw new Error('storage 500')
      rec.removed.push({ bucket, paths })
    },
  }
  return { deps, rec }
}

const row = (id: number, path: string, attempts = 0, bucket = 'shop-images'): QueueRow =>
  ({ id, bucket_id: bucket, object_path: path, attempts })

// isSanePath
eq('sane path 정상', isSanePath('shop-images', 'a/main/b.webp'), true)
eq('sane path 선행 슬래시', isSanePath('shop-images', '/a/b.webp'), false)
eq('sane path 버킷명 중복', isSanePath('shop-images', 'shop-images/a.webp'), false)
eq('sane path ..', isSanePath('shop-images', 'a/../b.webp'), false)
eq('sane path URL', isSanePath('shop-images', 'https://x/a.webp'), false)
eq('sane path 역슬래시', isSanePath('shop-images', 'a\\b.webp'), false)

{ // 참조 없음 → 삭제
  const { deps, rec } = makeDeps({ rows: [row(1, 's/main/1.webp')] })
  const r = await runCleanup(deps)
  eq('참조 없음 → remove 1회', rec.removed.length, 1)
  eq('참조 없음 → done', rec.done, [[1]])
  eq('참조 없음 → deleted 1', r.deleted, 1)
}

{ // 참조 있음 → blocked, remove 0회
  const { deps, rec } = makeDeps({
    rows: [row(1, 's/main/1.webp')],
    refs: { shop_images: [{ image_url: `${BASE}/shop-images/s/main/1.webp` }] },
  })
  const r = await runCleanup(deps)
  eq('blocked → remove 0회', rec.removed.length, 0)
  eq('blocked → markBlocked', rec.blocked.map(b => b.id), [1])
  eq('blocked → last_error 접두어', rec.blocked[0].message.startsWith('blocked:'), true)
  eq('blocked → attempts 증가 없음', rec.failure.length, 0)
  eq('blocked 집계', r.blocked, 1)
}

{ // 참조 조회 실패 → pending 복귀, remove 0회
  const { deps, rec } = makeDeps({ rows: [row(1, 's/main/1.webp')], selectThrows: true })
  const r = await runCleanup(deps)
  eq('조회 실패 → remove 0회', rec.removed.length, 0)
  eq('조회 실패 → release', rec.released, [[1]])
  eq('조회 실패 → failed 아님', rec.failure.length, 0)
  eq('조회 실패 집계', r.referenceCheckFailed, 1)
}

{ // unparseable 존재 → pending 복귀, remove 0회 (영구 격리 아님)
  const { deps, rec } = makeDeps({
    rows: [row(1, 's/main/1.webp')],
    refs: { shop_images: [{ image_url: `${BASE}/shop-images/a%2Fb/c.webp` }] },
  })
  const r = await runCleanup(deps)
  eq('unparseable → remove 0회', rec.removed.length, 0)
  eq('unparseable → release', rec.released, [[1]])
  eq('unparseable → failed 아님', rec.failure.length, 0)
  eq('unparseable 집계', r.referenceCheckFailed, 1)
}

{ // 허용되지 않은 버킷 → 즉시 failed, remove 0회
  const { deps, rec } = makeDeps({ rows: [row(1, 'a.webp', 0, 'other-bucket')] })
  await runCleanup(deps)
  eq('버킷 거부 → remove 0회', rec.removed.length, 0)
  eq('버킷 거부 → failed', rec.failure.map(f => f.status), ['failed'])
  eq('버킷 거부 → 메시지', rec.failure[0].message.startsWith('허용되지 않은 대상'), true)
}

{ // malformed path → 즉시 failed, remove 0회
  const { deps, rec } = makeDeps({ rows: [row(1, '/bad//path')] })
  await runCleanup(deps)
  eq('malformed → remove 0회', rec.removed.length, 0)
  eq('malformed → failed', rec.failure[0].status, 'failed')
  eq('malformed → 메시지', rec.failure[0].message, 'malformed object path')
}

{ // remove 실패 1회차 → attempts 1, pending
  const { deps, rec } = makeDeps({ rows: [row(1, 's/main/1.webp', 0)], removeThrows: true })
  await runCleanup(deps)
  eq('remove 실패 1회차 attempts', rec.failure[0].attempts, 1)
  eq('remove 실패 1회차 status', rec.failure[0].status, 'pending')
}

{ // remove 실패 5회차 → failed
  const { deps, rec } = makeDeps({ rows: [row(1, 's/main/1.webp', MAX_ATTEMPTS - 1)], removeThrows: true })
  await runCleanup(deps)
  eq('remove 실패 5회차 attempts', rec.failure[0].attempts, MAX_ATTEMPTS)
  eq('remove 실패 5회차 status', rec.failure[0].status, 'failed')
}

{ // 이미 없는 객체 — remove 가 성공으로 돌아오면 done (멱등)
  const { deps, rec } = makeDeps({ rows: [row(1, 's/main/gone.webp')] })
  await runCleanup(deps)
  eq('이미 없음 → done', rec.done, [[1]])
}

{ // exhibit-images 회귀 — 기존 버킷이 그대로 처리된다
  const { deps, rec } = makeDeps({
    rows: [row(1, 'u/1.jpg', 0, 'exhibit-images')],
    refs: { exhibit_images: [] },
  })
  const r = await runCleanup(deps)
  eq('exhibit 회귀 → remove 1회', rec.removed.length, 1)
  eq('exhibit 회귀 → 버킷', rec.removed[0].bucket, 'exhibit-images')
  eq('exhibit 회귀 → deleted', r.deleted, 1)
}

{ // exhibit-images 참조가 남아 있으면 삭제하지 않는다
  const { deps, rec } = makeDeps({
    rows: [row(1, 'u/1.jpg', 0, 'exhibit-images')],
    refs: { exhibit_images: [{ object_path: 'u/1.jpg' }] },
  })
  await runCleanup(deps)
  eq('exhibit 참조 → remove 0회', rec.removed.length, 0)
  eq('exhibit 참조 → blocked', rec.blocked.length, 1)
}

{ // 큐 비어 있음
  const { deps, rec } = makeDeps({ rows: [] })
  const r = await runCleanup(deps)
  eq('빈 큐 → remove 0회', rec.removed.length, 0)
  eq('빈 큐 → claimed 0', r.claimed, 0)
}

}

/* tsx 가 CJS 로 변환할 수 있어 top-level await 를 쓰지 않는다. */
main().then(() => {
  console.log(`\n${pass} passed, ${fails.length} failed`)
  if (fails.length) { for (const f of fails) console.log(`  - ${f}`); process.exit(1) }
}).catch(e => { console.error(e); process.exit(1) })
