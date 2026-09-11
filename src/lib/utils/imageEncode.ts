/* 이미지 인코딩 공통 유틸 — 신규 파일
 *
 * cropImage(크롭 좌표 적용)와 normalizeImage(직접 업로드 정규화)가 함께 쓴다.
 *
 * EXIF 방향은 브라우저 디코딩에 맡긴다. 자체 EXIF 파서도, 회전 행렬도 두지 않는다.
 * "이 브라우저가 적용하는가" 만 게이트로 판정한다 — browserAppliesExif() 참고.
 */

export const ALLOWED_INPUT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type OutputMime = 'image/jpeg' | 'image/webp'

/** 신규 업로드 규격.
 *
 *  기존 파일 일괄 마이그레이션은 장변 2560 초과만 변환한다 — 임계값이 다르다.
 *   - 신규 업로드는 어차피 인코딩을 한 번 거치므로 2048 로 맞춰도 추가 손실이 없다.
 *   - 기존 파일은 이미 인코딩된 것을 다시 인코딩하는 것이다. 실측상 2048~2560 구간은
 *     용량이 20% 남짓 줄면서 화질은 떨어진다(1920×2400 WebP → -19.6%, SSIM 0.974).
 *     그래서 마이그레이션은 2560 초과만 건드린다.
 */
export const SHOP_IMAGE_PRESET = {
  maxLongEdge: 2048,
  outputType: 'image/webp' as OutputMime,
  quality: 0.82,
}

export type UploadErrorCode =
  | 'unsupported-type'   // 허용하지 않는 MIME, 또는 type 이 빈 문자열
  | 'decode-failed'      // 이미지로 디코딩되지 않음 (손상·위장)
  | 'encode-failed'      // 캔버스 인코딩 실패
  | 'invalid-target'     // 저장 경로가 안전한 형식이 아님
  | 'upload-failed'      // Storage 업로드 실패 (네트워크·권한)
  | 'db-failed'          // DB 저장 실패

export class UploadError extends Error {
  constructor(public code: UploadErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'UploadError'
  }
}

export const UPLOAD_ERROR_TEXT: Record<UploadErrorCode, string> = {
  'unsupported-type': '파일 형식을 확인할 수 없습니다. JPG, PNG 또는 WebP 파일을 선택해주세요',
  'decode-failed':    '이미지를 읽을 수 없어요. 다른 파일로 시도해주세요',
  'encode-failed':    '이미지 변환에 실패했어요. 다시 시도해주세요',
  'invalid-target':   '이 매장에 사진을 올릴 수 없어요. 관리자에게 문의해주세요',
  'upload-failed':    '업로드에 실패했어요. 잠시 후 다시 시도해주세요',
  'db-failed':        '저장에 실패했어요',
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
}

/** MIME 에 맞는 확장자. 알 수 없으면 null. */
export function extOfMime(mime: string): string | null {
  return MIME_EXT[mime] ?? null
}

/** 파일명 확장자를 MIME 에 맞춘다.
 *  호출부가 이미 맞춰 보내더라도 이중 안전장치로 둔다. */
export function withExt(fileName: string, mime: OutputMime): string {
  const ext = MIME_EXT[mime] ?? 'bin'
  return /\.[A-Za-z0-9]{1,5}$/.test(fileName)
    ? fileName.replace(/\.[A-Za-z0-9]{1,5}$/, `.${ext}`)
    : `${fileName}.${ext}`
}

export function uuid(): string {
  try { return crypto.randomUUID() }
  catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}` }
}

export function encodeCanvas(
  canvas: HTMLCanvasElement, mime: OutputMime, quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new UploadError('encode-failed'))),
      mime, quality,
    )
  })
}

/** HTMLImageElement 로 디코딩한다.
 *  react-easy-crop 과 cropImage 가 쓰는 경로와 같다 —
 *  두 곳이 같은 디코더를 쓰게 해서 방향 기준이 갈리지 않게 한다. */
export function loadImageEl(src: string, crossOrigin = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new UploadError('decode-failed'))
    img.src = src
  })
}

/* ── EXIF 게이트 ─────────────────────────────────────────────────────────────
 *
 * 시료는 orientation=6 이 박힌 80×160 JPEG 한 장이다.
 * 브라우저가 EXIF 를 적용하면 160×80 으로 읽힌다. 적용하지 않으면 80×160 그대로다.
 *
 * 치수만 본다. 방향을 계산하지도, 보정하지도 않는다.
 *
 * 실측 (2026-09-11):
 *   Chrome 152 / Edge 152 (Windows) — <img> 경로에서 orientation 1~8 전부 적용 확인
 *   WebKit(iOS Safari) — 미측정
 *
 * 미적용 브라우저에서는 재인코딩이 방향 정보를 잃게 만들므로
 * normalizeImageFile 이 정규화를 건너뛰고 원본을 그대로 올린다(= 현행 동작, 회귀 없음).
 */
const PROBE_O6 = 'data:image/jpeg;base64,' + [
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDAAMCAgICAgMCAgIDAwMD',
  'BAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQ',
  'EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCACgAFADASIAAhEBAxEB/8QAHwAAAQUBAQEB',
  'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAk',
  'M2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKj',
  'pKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAA',
  'AAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl',
  '8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmq',
  'srO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwAooor4c/n86n4Vf8lQ8H/9',
  'h/T/AP0oSv0cr84/hV/yVDwf/wBh/T//AEoSv0cr6DJ/4cvU/SOB/wDd6v8AiX5BRRRXsH3AV4L8Tv8AkeNS/wC2P/olK96rwX4n',
  'f8jxqX/bH/0Slfm3il/yJ6f/AF9X/pMz6Hhr/e5f4X+aOXooor8FPtzy3/hmP44/9CR/5UrP/wCO0f8ADMfxx/6Ej/ypWf8A8dr7',
  '0or+rv7Iod3+H+R/O/8AqTl/88/vj/8AInxV4A/Z2+MeiePPDetap4P8mzsNXs7q4l/tC1bZEkyMzYWUk4AJwATX2rRRXZhsLDCp',
  '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',
].join('')

let probeCache: Promise<boolean> | null = null

export function browserAppliesExif(): Promise<boolean> {
  if (!probeCache) {
    probeCache = loadImageEl(PROBE_O6, false)
      .then(img => img.naturalWidth === 160 && img.naturalHeight === 80)
      .catch(() => false)          // 판정 불가 → 안전한 쪽(미적용)으로 본다
  }
  return probeCache
}
