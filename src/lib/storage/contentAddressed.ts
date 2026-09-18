/* 내용 주소 업로드 (2026-09-18)
 *
 * 경로 = <폴더>/<sha256(바이트)>.<매직바이트 확장자>, upsert:false.
 * 같은 이미지를 몇 번을 올려도 객체는 하나다. 2026-09-16~18 중복 정리(49세트,
 * 58,811,816 B)가 치운 것이 바로 "같은 바이트가 랜덤 경로로 여러 벌 쌓인" 상태였다.
 *
 * 안전 불변식: 경로가 곧 내용 해시이고 upsert:false 이므로, 같은 경로에 다른 바이트가
 * 들어가려면 그 바이트의 sha256 이 경로와 같아야 한다. 즉 덮어쓰기가 원리적으로 불가능하다.
 * 이 불변식에 기대는 검증이 정리 작업 전반에 깔려 있으므로 upsert:false 를 풀지 말 것.
 */

/** supabase-js 의 제네릭에 묶이지 않도록 구조적 타입만 요구한다. */
type StorageLike = {
  storage: {
    from(bucket: string): {
      upload(path: string, file: File, opts?: { upsert?: boolean }):
        Promise<{ error: { message: string } | null }>
      getPublicUrl(path: string): { data: { publicUrl: string } }
    }
  }
}

/** 2026-09-18 정리 산출물 49개가 이미 여기 있다. 같은 폴더를 써서 곧바로 합쳐지게 한다. */
export const CA_FOLDER = 'dedup-original'

export interface CaUploadResult {
  url: string | null
  path: string | null
  /** 같은 바이트가 이미 있어 업로드를 건너뛴 경우 */
  deduped: boolean
  /** 해시나 포맷 판정이 불가능해 호출자 폴백이 필요한 경우 */
  fallback: boolean
  error: string | null
}

/** 매직바이트로만 판정한다. 파일명과 MIME 은 근거로 쓰지 않는다. */
export function sniffExt(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
      && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif'
  return null
}

/** crypto.subtle 은 보안 컨텍스트에서만 동작한다. 없으면 null 을 돌려 폴백시킨다. */
export async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  try {
    const d = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

/** Supabase 는 upsert:false 중복 업로드를 409 로 돌려준다. 이건 실패가 아니라 적중이다. */
function isDuplicateError(e: { message?: string } | null): boolean {
  if (!e) return false
  const code = String((e as { statusCode?: string | number }).statusCode ?? '')
  if (code === '409') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('already exists') || m.includes('duplicate')
}

export async function uploadContentAddressed(
  supabase: StorageLike, bucket: string, file: File,
): Promise<CaUploadResult> {
  const miss: CaUploadResult = { url: null, path: null, deduped: false, fallback: true, error: null }

  let buf: ArrayBuffer
  try {
    buf = await file.arrayBuffer()
  } catch {
    return miss
  }

  const hash = await sha256Hex(buf)
  const ext = sniffExt(new Uint8Array(buf.slice(0, 16)))
  if (!hash || !ext) return miss

  const path = `${CA_FOLDER}/${hash}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })

  let deduped = false
  if (error) {
    if (!isDuplicateError(error)) {
      console.error('[내용 주소 업로드 실패]', error.message)
      return { url: null, path: null, deduped: false, fallback: false, error: error.message }
    }
    deduped = true
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, path, deduped, fallback: false, error: null }
}