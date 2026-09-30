/* 이벤트 import 스크립트용 — 이미지 자르기·압축 후 내용 주소로 업로드하는 헬퍼 (2026-09-21)
 *
 * 경로 = <folder>/<sha256(최종 바이트)>.webp, upsert:false.
 * 앱의 src/lib/storage/contentAddressed.ts 와 같은 불변식을 따른다:
 * 경로가 곧 내용 해시이므로 같은 경로에 다른 바이트가 들어갈 수 없고, 재실행해도 객체가 늘지 않는다.
 * 고정 경로 + upsert:true 로 올리던 옛 스크립트(2026-09-18 가드 추가)를 대체한다.
 *
 * 사용법:
 *   import { uploadEventImage } from './lib/uploadEventImage.mjs'
 *   const { url } = await uploadEventImage(db, 'poster.jpg', {
 *     folder: 'covers',                                 // 커버는 covers, 굿즈는 compact-official-events
 *     crop: { left: 20, top: 245, width: 940, height: 330 },  // 원본 픽셀 기준, 생략 가능
 *     maxWidth: 960,
 *   })
 */
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const BUCKET = 'event-goods'

/** 여러 영역을 잘라 같은 높이로 맞춘 뒤 가로로 이어 붙인다 (포스터에서 안내 문구를 빼고 특전만 남길 때). */
async function joinPieces(input, pieces, { gap = 16, background = '#ffffff' } = {}) {
  const height = Math.max(...pieces.map((p) => p.height))
  const parts = []
  for (const piece of pieces) {
    const buf = await sharp(input).rotate().extract(piece).resize({ height }).png().toBuffer()
    parts.push({ buf, width: (await sharp(buf).metadata()).width })
  }
  const width = parts.reduce((sum, p) => sum + p.width, 0) + gap * (parts.length - 1)
  let x = 0
  const composite = parts.map((p) => { const item = { input: p.buf, left: x, top: 0 }; x += p.width + gap; return item })
  return sharp({ create: { width, height, channels: 3, background } }).composite(composite).png().toBuffer()
}

export async function prepareEventImage(input, { crop = null, pieces = null, maxWidth = 1200, maxHeight = 2000, quality = 88 } = {}) {
  let img = sharp(pieces ? await joinPieces(input, pieces) : input).rotate()
  if (crop) img = img.extract(crop)
  const buffer = await img
    .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
  const meta = await sharp(buffer).metadata()
  return { buffer, width: meta.width, height: meta.height }
}

export async function uploadEventImage(db, input, { folder, ...options }) {
  if (!folder) throw new Error('folder is required')
  const { buffer, width, height } = await prepareEventImage(input, options)
  const hash = createHash('sha256').update(buffer).digest('hex')
  const path = `${folder}/${hash}.webp`
  const { error } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: 'image/webp', upsert: false })
  let deduped = false
  if (error) {
    const code = String(error.statusCode ?? '')
    const message = (error.message ?? '').toLowerCase()
    if (code !== '409' && !message.includes('already exists') && !message.includes('duplicate')) throw error
    deduped = true
  }
  const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  return { url, path, bytes: buffer.length, width, height, deduped }
}
