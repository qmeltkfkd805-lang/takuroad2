/* 이미 올라간 사진의 썸네일(가로 480px webp)을 한 번에 만든다.
   - 화면에서도 썸네일이 없으면 그때그때 만들어지지만(/api/thumb), 미리 만들어 두면 첫 방문자부터 가볍다.
   - 원본은 건드리지 않는다. 이미 있는 썸네일은 건너뛴다.
   - 먼저 migrations/thumbs_bucket.sql 을 실행해 thumbs 버킷을 만들어야 한다.

   실행 (프로젝트 폴더에서):
     node scripts/makeThumbs.mjs --dry          ← 몇 개 만들지만 세어 보기
     node scripts/makeThumbs.mjs                ← 실제로 만들기
     node scripts/makeThumbs.mjs shop-images    ← 버킷 하나만 */
import nextEnv from '@next/env'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
nextEnv.loadEnvConfig(root)

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요해요'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const only = args.filter(a => !a.startsWith('--'))
// 공개 버킷 중 사진이 있는 곳 (visit-photos 는 비공개라 제외)
const BUCKETS = only.length ? only : ['shop-images', 'goods-images', 'places', 'route-photos', 'event-goods']
const IMG = /\.(webp|jpe?g|png|gif|avif)$/i

// 버킷 안의 모든 파일 경로 (폴더를 따라 내려간다)
async function listAll(bucket, prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) { console.warn(`  목록 실패 ${bucket}/${prefix}: ${error.message}`); break }
    if (!data?.length) break
    for (const f of data) {
      const p = prefix ? `${prefix}/${f.name}` : f.name
      if (f.id === null) out.push(...await listAll(bucket, p))   // 폴더
      else if (IMG.test(f.name)) out.push(p)
    }
    if (data.length < 1000) break
  }
  return out
}

async function exists(path) {
  const i = path.lastIndexOf('/')
  const { data } = await sb.storage.from('thumbs').list(path.slice(0, i), { search: path.slice(i + 1), limit: 5 })
  return !!data?.some(f => f.name === path.slice(i + 1))
}

let made = 0, skipped = 0, failed = 0, savedKB = 0
for (const bucket of BUCKETS) {
  const files = await listAll(bucket)
  console.log(`\n[${bucket}] 사진 ${files.length}개`)
  for (const path of files) {
    const tPath = `${bucket}/${path}.webp`
    if (await exists(tPath)) { skipped++; continue }
    if (DRY) { made++; continue }
    try {
      const { data: blob, error } = await sb.storage.from(bucket).download(path)
      if (error || !blob) throw new Error(error?.message ?? 'download')
      const buf = Buffer.from(await blob.arrayBuffer())
      const out = await sharp(buf, { failOn: 'none' }).rotate()
        .resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer()
      const { error: upErr } = await sb.storage.from('thumbs').upload(tPath, out, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
      if (upErr && !/exists|duplicate/i.test(upErr.message)) throw new Error(upErr.message)
      made++; savedKB += Math.max(0, (buf.length - out.length) / 1024)
      if (made % 50 === 0) console.log(`  ${made}개 만듦…`)
    } catch (e) {
      failed++; console.warn(`  실패 ${bucket}/${path}: ${e.message}`)
    }
  }
}
console.log(`\n${DRY ? '[미리보기] 만들 썸네일' : '만든 썸네일'} ${made}개 · 이미 있음 ${skipped}개 · 실패 ${failed}개`)
if (!DRY && made) console.log(`사진 한 장당 평균 ${Math.round(savedKB / made)}KB 가벼워졌어요`)
