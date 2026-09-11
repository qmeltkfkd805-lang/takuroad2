/* 직접 업로드 File 정규화 — 신규 파일
 *
 * 크롭을 거치지 않는 업로드에도 같은 규격을 적용한다.
 * 크롭 좌표는 다루지 않는다 — 그건 cropImage 의 역할이다.
 */

import {
  ALLOWED_INPUT_MIME, SHOP_IMAGE_PRESET, OutputMime,
  UploadError, encodeCanvas, withExt, loadImageEl, browserAppliesExif,
} from './imageEncode'

export interface NormalizeOptions {
  maxLongEdge: number
  outputType: OutputMime
  quality: number
}

/** 업로드 전 정규화. 실패는 UploadError 로 던진다.
 *
 *  건너뛰는 경우 — 둘 다 원본 File 을 그대로 돌려준다.
 *   1. 브라우저가 EXIF 방향을 적용하지 않는 경우
 *      재인코딩하면 방향 정보가 사라져 누운 사진이 영구 저장된다.
 *      현행 동작(원본 업로드)을 유지하는 편이 안전하다.
 *   2. 이미 WebP 이고 장변이 상한 이하인 경우
 *      재인코딩해도 이득이 작고 화질만 떨어진다(실측 -19.6%, SSIM 0.974).
 */
export async function normalizeImageFile(
  file: File,
  fileName: string,
  opts: NormalizeOptions = SHOP_IMAGE_PRESET,
): Promise<File> {
  if (!file.type || !ALLOWED_INPUT_MIME.has(file.type)) {
    throw new UploadError('unsupported-type')
  }

  if (!(await browserAppliesExif())) return file        // 건너뛰기 1

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageEl(url, false)           // 실패 시 decode-failed
    const w0 = img.naturalWidth
    const h0 = img.naturalHeight
    if (!w0 || !h0) throw new UploadError('decode-failed')

    const long = Math.max(w0, h0)
    // 확대 금지 — 상한보다 작으면 그대로 둔다
    const scale = long > opts.maxLongEdge ? opts.maxLongEdge / long : 1

    if (scale === 1 && file.type === opts.outputType) return file   // 건너뛰기 2

    const w = Math.max(1, Math.round(w0 * scale))
    const h = Math.max(1, Math.round(h0 * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new UploadError('encode-failed')

    // JPEG 는 알파를 표현할 수 없다. 캔버스 기본값이 투명이라 그대로 두면 검정이 된다.
    // WebP 는 알파를 보존하므로 채우지 않는다.
    if (opts.outputType === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await encodeCanvas(canvas, opts.outputType, opts.quality)
    return new File([blob], withExt(fileName, opts.outputType), { type: opts.outputType })
  } finally {
    URL.revokeObjectURL(url)
  }
}
