/* 크롭 좌표 적용 — 기존 파일 수정
 *
 * 변경 요약
 *  1. 5번째 인수로 출력 옵션을 받는다. 주지 않으면 기존 동작 그대로다.
 *  2. 중간 회전 캔버스를 없앴다. 회전·크롭·축소를 합성 변환 한 번으로 처리한다.
 *     cropArea 를 변형하지 않으므로 좌표가 어긋날 여지가 없고, 큰 이미지에서
 *     bbox 캔버스를 만들지 않아 메모리도 줄어든다.
 *  3. JPEG 출력 시 배경을 흰색으로 채운다.
 *     기존에는 투명 영역(회전으로 생긴 모서리, 투명 PNG 입력)이 검정이 됐다.
 *     의도적인 버그 수정이며, 옵션 없는 기존 호출의 결과가 바뀌는 유일한 지점이다.
 *
 * EXIF 방향은 브라우저 디코딩에 맡긴다. react-easy-crop 도 같은 <img> 경로를 쓰므로
 * 화면에서 선택한 영역과 출력 영역의 기준이 갈리지 않는다.
 */

import {
  OutputMime, UploadError, encodeCanvas, withExt, loadImageEl,
} from './imageEncode'

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export interface CropOutputOptions {
  /** 결과 장변 상한. 미지정이면 제한 없음 (기존 동작) */
  maxLongEdge?: number
  /** 기본 'image/jpeg' (기존 동작) */
  outputType?: OutputMime
  /** 기본 0.9 (기존 동작) */
  quality?: number
}

export async function getCroppedImageFile(
  imageSrc: string,
  cropArea: CropArea,
  fileName: string,
  rotation = 0,
  opts: CropOutputOptions = {},
): Promise<File> {
  const mime: OutputMime = opts.outputType ?? 'image/jpeg'
  const quality = opts.quality ?? 0.9

  const image = await loadImageEl(imageSrc)
  const srcW = image.naturalWidth
  const srcH = image.naturalHeight
  if (!srcW || !srcH) throw new UploadError('decode-failed')

  // 회전 후 경계 상자 — 좌표 계산에만 쓴다. 이 크기의 캔버스를 만들지 않는다.
  const rotRad = (rotation * Math.PI) / 180
  const { width: bBoxW, height: bBoxH } = getRotatedSize(srcW, srcH, rotation)

  // 출력 크기 — 확대 금지.
  // cropArea 는 "회전 후 좌표계" 값이므로 90/270° 결과 크기가 이미 반영돼 있다.
  const outLong = Math.max(cropArea.width, cropArea.height)
  const outScale = opts.maxLongEdge && outLong > opts.maxLongEdge
    ? opts.maxLongEdge / outLong
    : 1
  const outW = Math.max(1, Math.round(cropArea.width * outScale))
  const outH = Math.max(1, Math.round(cropArea.height * outScale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new UploadError('encode-failed')

  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, outW, outH)
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 회전 → 크롭 → 축소를 한 번에.
  // 기존 코드가 bbox 캔버스에 그린 뒤 cropArea 로 잘라내던 것과 수학적으로 같다.
  ctx.scale(outScale, outScale)          // 출력 축소 (outScale ≤ 1)
  ctx.translate(-cropArea.x, -cropArea.y) // 회전 후 좌표계의 크롭 원점으로
  ctx.translate(bBoxW / 2, bBoxH / 2)     // 기존과 동일한 회전 중심
  ctx.rotate(rotRad)
  ctx.drawImage(image, -srcW / 2, -srcH / 2, srcW, srcH)
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const blob = await encodeCanvas(canvas, mime, quality)
  return new File([blob], withExt(fileName, mime), { type: mime })
}

function getRotatedSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}
