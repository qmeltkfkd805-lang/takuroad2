/* Storage 참조 정규화 — 삭제 안전성의 핵심 모듈
 *
 * 과거 고아 정리에서 `like '%' || path` (suffix LIKE) 는 오탐 위험 때문에 금지했다.
 * 여기서도 쓰지 않는다. 모든 참조값을 canonical {bucket, path} 로 바꾼 뒤
 * bucket 과 path 가 **둘 다 완전히** 같을 때만 동일 참조로 본다.
 *
 * 이 파일은 참조 출처 레지스트리의 유일한 정의처다.
 * 워커의 어느 단계도 출처 목록을 따로 하드코딩하지 않는다.
 */

export interface StorageRefKey {
  bucket: string
  path: string
}

export type ParsedRef =
  | { kind: 'storage'; bucket: string; path: string }
  /** 우리 Storage 가 아니다. 비교 대상이 아니며 삭제를 막지 않는다. */
  | { kind: 'external' }
  /** 내부 Storage URL 로 보이는데 해석에 실패했다. 보수적으로 다뤄야 한다. */
  | { kind: 'unparseable'; why: string }

/* bucket 이름에는 '/' 가 들어갈 수 없으므로 첫 '/' 가 경계가 된다. 모호하지 않다.
   (제어문자를 구분자로 쓰면 소스가 바이너리로 취급된다) */
export const refKey = (bucket: string, path: string) => `${bucket}/${path}`

const STORAGE_PREFIXES = [
  '/storage/v1/object/public/',
  '/storage/v1/object/sign/',
  '/storage/v1/object/authenticated/',
  '/storage/v1/render/image/public/',
  '/storage/v1/render/image/sign/',
  '/storage/v1/render/image/authenticated/',
]

function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return true
  }
  return false
}

/** decodeURIComponent 를 세그먼트 단위로만 적용한다.
 *  pathname 전체를 한 번에 decode 하면 %2F 가 '/' 로 바뀌어 경계가 흐려진다.
 *  '+' 는 공백으로 바꾸지 않는다(decodeURIComponent 의 정상 동작). */
function decodeSegments(encoded: string): { ok: true; value: string } | { ok: false; why: string } {
  const segs = encoded.split('/')
  const out: string[] = []
  for (const seg of segs) {
    let d: string
    try {
      d = decodeURIComponent(seg)
    } catch {
      return { ok: false, why: 'malformed percent-encoding' }
    }
    // 세그먼트 안에서 %2F 가 '/' 로 풀리면 폴더 구분자인지 파일명 속 슬래시인지 알 수 없다.
    if (d.includes('/')) return { ok: false, why: 'ambiguous %2F inside segment' }
    out.push(d)
  }
  return { ok: true, value: out.join('/') }
}

/** decode 후 경로 상식 검사. 실패하면 unparseable 로 본다. */
function pathIsSane(p: string): string | null {
  if (p === '') return 'empty path'
  if (p.startsWith('/')) return 'leading slash'
  if (p.split('/').some(s => s === '' || s === '.' || s === '..')) return 'empty or dot segment'
  if (hasControlChar(p)) return 'control character'
  if (p.includes('\\')) return 'backslash'
  return null
}

/** URL 문자열 하나를 canonical 참조로 바꾼다.
 *  supabaseHost 는 현재 서버 환경의 Supabase URL 에서 정규화해 넘긴다. 상수를 새로 만들지 않는다. */
export function parseUrlRef(raw: string, supabaseHost: string): ParsedRef {
  const value = raw.trim()
  if (value === '') return { kind: 'external' }

  if (!/^https?:\/\//i.test(value)) {
    /* URL 컬럼인데 http(s) 가 아니다. 세 갈래로 나눈다.

       ① '/' 로 시작 → 앱 내부 경로다. public/ 아래 정적 자산이거나 라우트다.
          Storage 참조가 될 수 없으므로 external.
          2026-09-12 실측: badge_tiers.icon_url 43 · badges.icon_url 20 ·
          cosmetics.asset_url 9 = 72건이 전부 이 형태였다 (/badges/x.png 등).
       ② '/' 를 포함하지만 '/' 로 시작하지 않음 → '{bucket}/{path}' 일 수 있다.
          기존 고아 조사 SQL 은 이 형태를 bucket/path 로 해석했다.
          단정하지 않고 unparseable 로 올려 삭제를 막는다. 실측 0건이다.
       ③ '/' 없음 → 참조가 될 수 없다. external. */
    if (value.startsWith('/')) return { kind: 'external' }
    return value.includes('/')
      ? { kind: 'unparseable', why: 'non-URL value in URL column' }
      : { kind: 'external' }
  }

  let u: URL
  try {
    u = new URL(value)
  } catch {
    return value.includes('/storage/v1/')
      ? { kind: 'unparseable', why: 'invalid URL' }
      : { kind: 'external' }
  }

  /* query · fragment 는 URL 객체가 이미 분리했다. pathname 은 아직 percent-encoded 상태다.
     new URL() 은 pathname 의 dot segment('..', '.')를 먼저 정규화한다.
     HTTP 클라이언트와 Supabase 도 같은 규칙으로 해석하므로 정규화된 경로가 실제 참조 대상이다.
     보호 대상이 하나 늘 뿐이라 방향이 안전하다.
     WHATWG URL 은 %2E·%2e 도 dot 으로 보고 정규화하므로 인코딩 우회가 없다.
     빈 세그먼트('//')는 정규화되지 않으므로 디코딩 뒤 pathIsSane 이 잡는다.
     path 컬럼 값은 URL 정규화를 거치지 않으므로 pathIsSane 의 dot 검사가 그쪽에서 실효를 갖는다. */
  const pathname = u.pathname

  const prefix = STORAGE_PREFIXES.find(p => pathname.startsWith(p))
  if (!prefix) {
    return pathname.includes('/storage/v1/')
      ? { kind: 'unparseable', why: 'unknown storage path shape' }
      : { kind: 'external' }
  }

  // host 가 우리 프로젝트가 아니면 같은 모양이어도 단정할 수 없다. 보수적으로 unparseable.
  if (u.host.toLowerCase() !== supabaseHost.toLowerCase()) {
    return { kind: 'unparseable', why: 'storage-shaped URL on another host' }
  }

  const rest = pathname.slice(prefix.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return { kind: 'unparseable', why: 'missing bucket or object path' }

  // bucket 경계를 decode 이전에 먼저 나눈다.
  const bucketEnc = rest.slice(0, slash)
  const pathEnc = rest.slice(slash + 1)

  const b = decodeSegments(bucketEnc)
  if (!b.ok) return { kind: 'unparseable', why: `bucket: ${b.why}` }
  const p = decodeSegments(pathEnc)
  if (!p.ok) return { kind: 'unparseable', why: `path: ${p.why}` }

  if (b.value === '' || b.value.includes('/')) return { kind: 'unparseable', why: 'bad bucket segment' }
  const bad = pathIsSane(p.value)
  if (bad) return { kind: 'unparseable', why: `path: ${bad}` }

  return { kind: 'storage', bucket: b.value, path: p.value }
}

/** object path 컬럼 하나를 canonical 참조로 바꾼다.
 *  이 컬럼들은 인코딩되지 않은 원본 경로를 담으므로 percent-decoding 하지 않는다. */
export function parsePathRef(bucket: string | null | undefined, raw: string): ParsedRef {
  if (!bucket || bucket.trim() === '') return { kind: 'unparseable', why: 'missing bucket' }
  const p = raw.trim().replace(/^\/+/, '')
  const bad = pathIsSane(p)
  if (bad) return { kind: 'unparseable', why: `path: ${bad}` }
  return { kind: 'storage', bucket: bucket.trim(), path: p }
}

/** URL 일 수도 있고 순수 path 일 수도 있는 컬럼(예: shop_verify_requests.evidence_url) */
export function parseUrlOrPathRef(raw: string, fallbackBucket: string, supabaseHost: string): ParsedRef {
  const value = raw.trim()
  if (value === '') return { kind: 'external' }
  if (/^https?:\/\//i.test(value)) return parseUrlRef(value, supabaseHost)
  return parsePathRef(fallbackBucket, value)
}

/* ============================================================
 * 참조 출처 레지스트리
 *
 * information_schema 로 public 스키마의 image/url/path 계열 컬럼을 전수 조회해
 * 2026-09-12 기준으로 확정했다. 컬럼이 추가·삭제되면 여기를 함께 고쳐야 한다.
 *
 * 제외한 컬럼과 근거
 *   exhibit_storage_cleanup_queue.object_path  큐 자신. 참조가 아니다
 *   goods_collection_covers.cover_item_id      uuid FK
 *   pilgrimage_list_shops.pilgrimage_list_id   uuid FK
 *   shop_images.is_cover / profiles.is_profile_public / shops.photo_allowed   boolean
 *   shop_product_images.image_type             라벨 문자열
 *   profiles.signup_landing_path               앱 라우트 경로
 *   visit_logs.path                            앱 라우트 경로
 *
 * 외부 링크만 담는 컬럼(소셜 링크 등)도 포함했다. 파서가 external 로 분류하므로
 * 삭제를 막지 않고, 누락으로 인한 오삭제 위험만 없앤다.
 * ============================================================ */

export type RefSource =
  | { kind: 'url'; table: string; column: string }
  | { kind: 'jsonArray'; table: string; column: string }
  | { kind: 'textArray'; table: string; column: string }
  | { kind: 'path'; table: string; column: string; bucket: string }
  | { kind: 'pathWithBucketColumn'; table: string; column: string; bucketColumn: string }
  | { kind: 'urlOrPath'; table: string; column: string; fallbackBucket: string }

export const REF_SOURCES: RefSource[] = [
  // ── 단일 URL 컬럼 ──
  { kind: 'url', table: 'badge_tiers',         column: 'icon_url' },
  { kind: 'url', table: 'badges',              column: 'icon_url' },
  { kind: 'url', table: 'contact_messages',    column: 'page_url' },
  { kind: 'url', table: 'cosmetics',           column: 'asset_url' },
  { kind: 'url', table: 'cosmetics',           column: 'preview_url' },
  { kind: 'url', table: 'event_goods',         column: 'image_url' },
  { kind: 'url', table: 'event_goods_history', column: 'image_url' },
  { kind: 'url', table: 'event_submissions',   column: 'source_url' },
  { kind: 'url', table: 'events',              column: 'cover_url' },
  { kind: 'url', table: 'events',              column: 'video_url' },
  { kind: 'url', table: 'fan_arts',            column: 'image_url' },
  { kind: 'url', table: 'featured_banners',    column: 'image_url' },
  { kind: 'url', table: 'goods_item_images',   column: 'external_url' },
  { kind: 'url', table: 'home_hero_slots',     column: 'custom_image_url' },
  { kind: 'url', table: 'notices',             column: 'image_url' },
  { kind: 'url', table: 'places',              column: 'cover_image' },
  { kind: 'url', table: 'places',              column: 'cover_url' },
  { kind: 'url', table: 'post_appeals',        column: 'original_url' },
  { kind: 'url', table: 'profiles',            column: 'avatar_url' },
  { kind: 'url', table: 'review_images',       column: 'image_url' },
  { kind: 'url', table: 'routes',              column: 'cover_image_url' },
  { kind: 'url', table: 'seasonal_events',     column: 'cover_image_url' },
  { kind: 'url', table: 'shop_events',         column: 'image_url' },
  { kind: 'url', table: 'shop_events',         column: 'video_url' },
  { kind: 'url', table: 'shop_highlights',     column: 'image_url' },
  { kind: 'url', table: 'shop_images',         column: 'image_url' },
  { kind: 'url', table: 'shop_product_images', column: 'image_url' },
  { kind: 'url', table: 'shop_suggestions',    column: 'image_url' },
  { kind: 'url', table: 'shops',               column: 'blog_url' },
  { kind: 'url', table: 'shops',               column: 'instagram_url' },
  { kind: 'url', table: 'shops',               column: 'kakao_channel_url' },
  { kind: 'url', table: 'shops',               column: 'twitter_url' },
  { kind: 'url', table: 'shops',               column: 'website_url' },
  { kind: 'url', table: 'tags',                column: 'banner_image' },
  { kind: 'url', table: 'tags',                column: 'cover_url' },
  { kind: 'url', table: 'tags',                column: 'homepage_url' },
  { kind: 'url', table: 'tags',                column: 'official_url' },
  { kind: 'url', table: 'tags',                column: 'twitter_url' },
  { kind: 'url', table: 'tags',                column: 'youtube_url' },

  // ── JSON 배열 ──
  { kind: 'jsonArray', table: 'community_posts',   column: 'images' },
  { kind: 'jsonArray', table: 'event_submissions', column: 'source_urls' },
  { kind: 'jsonArray', table: 'event_submissions', column: 'ticket_urls' },
  { kind: 'jsonArray', table: 'events',            column: 'source_urls' },
  { kind: 'jsonArray', table: 'events',            column: 'ticket_urls' },
  { kind: 'jsonArray', table: 'post_appeals',      column: 'proof_images' },

  // ── SQL 배열 ──
  { kind: 'textArray', table: 'contact_messages', column: 'attachment_urls' },

  // ── object path ──
  { kind: 'path',                 table: 'exhibit_images',   column: 'object_path', bucket: 'exhibit-images' },
  { kind: 'pathWithBucketColumn', table: 'goods_item_images', column: 'object_path', bucketColumn: 'bucket_name' },
  { kind: 'pathWithBucketColumn', table: 'shop_images',       column: 'storage_path', bucketColumn: 'storage_bucket' },

  // ── URL 또는 path ──
  { kind: 'urlOrPath', table: 'shop_verify_requests', column: 'evidence_url', fallbackBucket: 'verify-documents' },
]

/* ============================================================
 * 참조 스냅샷
 * ============================================================ */

/** 테이블에서 지정한 컬럼들을 전부 읽는다. 페이지네이션과 상한을 강제한다.
 *  실패하면 반드시 throw 한다 — 오류를 "참조 없음"으로 취급하면 안 된다. */
export type SelectAllFn = (
  table: string,
  columns: string[],
) => Promise<Record<string, unknown>[]>

export interface ReferenceSnapshot {
  /** `${bucket}/${path}` 집합 */
  keys: Set<string>
  /** 내부 Storage URL 로 보이는데 해석 실패한 건수 */
  unparseable: number
  /** 진단용. 원문 URL·토큰은 담지 않는다. */
  unparseableSamples: { source: string; why: string }[]
  scanned: number
}

function pushValue(
  out: ReferenceSnapshot,
  sourceLabel: string,
  parsed: ParsedRef,
) {
  out.scanned++
  if (parsed.kind === 'storage') out.keys.add(refKey(parsed.bucket, parsed.path))
  else if (parsed.kind === 'unparseable') {
    out.unparseable++
    if (out.unparseableSamples.length < 10) {
      // 값 원문은 남기지 않는다. 출처와 사유만.
      out.unparseableSamples.push({ source: sourceLabel, why: parsed.why })
    }
  }
}

/** 전 출처를 훑어 canonical 참조 집합을 만든다.
 *  조회가 하나라도 실패하면 throw 한다. 호출자는 그 청크의 삭제를 진행하면 안 된다. */
export async function buildReferenceSnapshot(
  selectAll: SelectAllFn,
  supabaseHost: string,
  sources: RefSource[] = REF_SOURCES,
): Promise<ReferenceSnapshot> {
  const snap: ReferenceSnapshot = {
    keys: new Set(), unparseable: 0, unparseableSamples: [], scanned: 0,
  }

  for (const s of sources) {
    const label = `${s.table}.${s.column}`
    const cols = s.kind === 'pathWithBucketColumn' ? [s.column, s.bucketColumn] : [s.column]
    const rows = await selectAll(s.table, cols)

    for (const row of rows) {
      const v = row[s.column]
      if (v === null || v === undefined) continue

      switch (s.kind) {
        case 'url':
          if (typeof v === 'string') pushValue(snap, label, parseUrlRef(v, supabaseHost))
          break
        case 'jsonArray':
        case 'textArray':
          if (Array.isArray(v)) {
            for (const item of v) {
              if (typeof item === 'string') pushValue(snap, label, parseUrlRef(item, supabaseHost))
            }
          }
          break
        case 'path':
          if (typeof v === 'string') pushValue(snap, label, parsePathRef(s.bucket, v))
          break
        case 'pathWithBucketColumn': {
          const b = row[s.bucketColumn]
          if (typeof v === 'string') {
            pushValue(snap, label, parsePathRef(typeof b === 'string' ? b : null, v))
          }
          break
        }
        case 'urlOrPath':
          if (typeof v === 'string') {
            pushValue(snap, label, parseUrlOrPathRef(v, s.fallbackBucket, supabaseHost))
          }
          break
      }
    }
  }

  return snap
}

/** 스냅샷에서 특정 객체가 아직 참조되는지 정확 비교로 판정한다. */
export function isReferenced(snap: ReferenceSnapshot, bucket: string, path: string): boolean {
  return snap.keys.has(refKey(bucket, path))
}
