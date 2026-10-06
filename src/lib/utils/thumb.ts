/* 목록용 작은 사진(썸네일) 주소
   원본: {SUPABASE}/storage/v1/object/public/{버킷}/{경로}
   썸네일: {SUPABASE}/storage/v1/object/public/thumbs/{버킷}/{경로}.webp   (가로 480px, webp)

   썸네일은 /api/thumb 가 만든다 — 화면에서 썸네일이 아직 없으면(404) 원본을 대신 보여주고
   그때 한 번 만들어 달라고 요청한다(ThumbImg). 그래서 업로드 코드를 고치지 않아도 점점 채워진다.
   Supabase 저장소가 아닌 주소(외부 포스터 등)는 그대로 둔다. */

export const THUMB_BUCKET = 'thumbs'
export const THUMB_WIDTH = 480

const PUBLIC_MARK = '/storage/v1/object/public/'

/** 원본 주소 → { bucket, path } (Supabase 공개 주소가 아니면 null) */
export function parseStorageUrl(url: string | null | undefined): { origin: string; bucket: string; path: string } | null {
  if (!url) return null
  const i = url.indexOf(PUBLIC_MARK)
  if (i < 0) return null
  const origin = url.slice(0, i)
  const rest = url.slice(i + PUBLIC_MARK.length).split(/[?#]/)[0]
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const bucket = rest.slice(0, slash)
  const path = rest.slice(slash + 1)
  if (!path || bucket === THUMB_BUCKET) return null
  return { origin, bucket, path }
}

/** 썸네일 주소 (만들 수 없는 주소면 null) */
export function thumbUrl(url: string | null | undefined): string | null {
  const p = parseStorageUrl(url)
  if (!p) return null
  return `${p.origin}${PUBLIC_MARK}${THUMB_BUCKET}/${p.bucket}/${p.path}.webp`
}
