/* 업로드 전 이미지 압축 (2026-09-19)
 *
 * 규칙
 *   · 이미지가 아니면 원본 그대로 돌려준다 (PDF·문서 첨부 보호)
 *   · GIF 는 건너뛴다 — canvas 재인코딩은 애니메이션을 죽인다
 *   · 변환이 실패하면 원본을 돌려준다. 압축 때문에 업로드가 막히면 안 된다
 *   · 확장자와 contentType 을 같이 돌려주므로 호출부는 그대로 쓰면 된다
 *
 * EXIF·GPS 는 canvas 재인코딩 과정에서 함께 사라진다.
 */

export interface Prepared {
  data: Blob | File
  ext: string
  contentType: string
  compressed: boolean
}

function extOf(type: string, fallback = 'jpg'): string {
  const m = type.split('/')[1]
  if (!m || !/^[a-z0-9.+-]+$/i.test(m)) return fallback
  return m === 'jpeg' ? 'jpg' : m.replace(/\+.*$/, '')
}

/** 사진용 기본값 1600px / q85. 포스터처럼 글자가 많으면 넉넉하게 준다. */
export async function prepareImage(
  file: File, maxSize = 1600, quality = 0.85,
): Promise<Prepared> {
  const raw: Prepared = {
    data: file, ext: extOf(file.type || 'image/jpeg'),
    contentType: file.type || 'image/jpeg', compressed: false,
  }
  if (!file.type?.startsWith('image/')) return raw
  if (file.type === 'image/gif') return raw
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return raw

  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    if (width > maxSize || height > maxSize) {
      const s = maxSize / Math.max(width, height)
      width = Math.round(width * s); height = Math.round(height * s)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return raw }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), 'image/webp', quality))
    // 원본보다 커지면(작은 PNG 등) 변환 이득이 없다
    if (!blob || blob.size >= file.size) return raw
    return { data: blob, ext: 'webp', contentType: 'image/webp', compressed: true }
  } catch {
    return raw
  }
}