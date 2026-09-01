import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = '9dc1872d-1309-49ab-bd2b-e6567271ddcc'
const koreanSource = 'https://x.com/SpaceGalleriaKR/status/2094261042771833280'
const goodsSource = 'https://given-exhibition.com/goods/'

const base = 'https://given-exhibition.com/images/media'
const items = [
  ['레코드 스타일 코스터 (리츠카&마후유) (전량 품절)', `${base}/2024/09/c0187541ba22837e93cd38522ccda2f9.jpg`],
  ['레코드 스타일 코스터 (시즈스미&히이라기) (전량 품절)', `${base}/2024/09/95b0d9963a22ef94b69a4e3ae441f3b4.jpg`],
  ['츄아스타 미니어처 아크릴 스탠드 컬렉션 (전 8종) (전량 품절)', `${base}/2026/03/74ba669fc2db363d3875d90eeb54bb50.jpg`],
  ['포스트 카드 8장 세트 (전량 품절)', `${base}/2023/11/66917e678a29e413dd7ce8f5c9a5fdee.jpg`],
  ['포스트 카드 5장 세트 (전량 품절)', `${base}/2023/12/715d853b824fe664c4188e91f6004541.jpg`],
  ['앨범 재킷 스타일 키링 (syh) (전량 품절)', `${base}/2024/05/44ca9b508a3f534b14a3e682ae772ff2.jpg`],
  ['플레이 리스트 아크릴 키링 (전량 품절)', `${base}/2024/09/d0b208f087a46b52e1fcd2aa3da8c4ab.jpg`],
  ['머플러 타월 (기븐) (전량 품절)', `${base}/2025/09/833bd7024c3e223075f09488260ba6be.jpg`],
  ['머플러 타월 (syh) (전량 품절)', `${base}/2025/09/49f3578b784be41f0d6835acc52da9d2.jpg`],
  ['자수 타월 (기븐) (전량 품절)', `${base}/2026/03/fbd13670bbf4c08efb60a71578c12294.jpg`],
  ['자수 타월 (케다마) (전량 품절)', `${base}/2026/03/dfee14724b3cf2f0eaf3c752fe347c42.jpg`],
  ['커플 컷 스티커 (마후유&리츠카) (전량 품절)', `${base}/2026/04/d2a8decade58e2f207a8eb2af36e5c49.jpg`],
  ['5108 메시지 목걸이 「바다로」 (전량 품절)', `${base}/2025/10/d7b8c56524f7dc5a8f2a8be55622ef6f.jpg`],
  ['클리어 파일 G·H·I (전량 품절)', `${base}/2025/04/9dab984df16c655c186351383baa14b8.jpg`],
  ['복제 원고 J (전량 품절)', `${base}/2025/09/f81b07b2d68c010316a1fba0c1c082b2.jpg`],
  ['아크릴 아트 패널 C (전량 품절)', `${base}/2025/09/476a4b5a4272d3ff3242fc1f382cda7b.jpg`],
  ['증명사진 (마후유·리츠카·아키히코·히이라기·유키·우게츠) (전량 품절)', `${base}/2025/04/c4e0bf22899baa9aab38bf49bb3f0281.jpg`],
  ['다이컷 스티커 (마후유·리츠카·하루키·아키히코·우게츠·히이라기) (전량 품절)', `${base}/2025/09/4050f424ea21d070ad44db6315457d0c.jpg`],
  ['금박 스티커 A (GIVEN展) (전량 품절)', `${base}/2026/03/0c12a9958ec60953a63e9e506632324c.jpg`],
  ['은박 스티커 A (GIVEN展 ENCORE) (전량 품절)', `${base}/2026/03/e057ca7dd89b599ac0bf7d925465373c.jpg`],
  ['스티커 세트 B (전량 품절)', `${base}/2025/10/298c1dca601c99ee17fa9858c8f96ac0.jpg`],
  ['클리어 시트 세트 (전량 품절)', `${base}/2024/09/69ccd06112bfcada2b5de0e2f9a54f68.jpg`],
  ['「기븐 10th mix」 이어지는 BIG 아크릴 스탠드 (5종) (전량 품절)', `${base}/2025/09/badd2c9218ce67c29070d5f32e24c0dd.jpg`],
  ['이어지는 BIG 아크릴 스탠드 (마후유·리츠카·우게츠) (전량 품절)', `${base}/2023/12/51e7a7176747f3ba29d97e4c405fc7aa.jpg`],
]

const existing = await db.from('event_goods').select('*').eq('event_id', eventId).eq('is_deleted', false)
if (existing.error) throw existing.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(
  `scripts/event-goods-backups/before-given-encore-soldout-${Date.now()}.json`,
  JSON.stringify({ eventId, koreanSource, goodsSource, rows: existing.data }, null, 2),
)

const rows = []
for (let index = 0; index < items.length; index += 1) {
  const [name, imageSource] = items[index]
  const response = await fetch(imageSource)
  if (!response.ok) throw new Error(`image ${response.status}: ${imageSource}`)
  const extension = new URL(imageSource).pathname.split('.').pop() || 'jpg'
  const storagePath = `given-encore-seoul-2026/soldout/${String(index + 1).padStart(2, '0')}.${extension}`
  const upload = await db.storage.from('event-goods').upload(storagePath, Buffer.from(await response.arrayBuffer()), {
    contentType: response.headers.get('content-type') ?? 'image/jpeg',
    upsert: true,
  })
  if (upload.error) throw upload.error
  rows.push({
    event_id: eventId,
    name,
    kind: 'goods',
    price: null,
    image_url: db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl,
    created_by: editor,
    updated_by: editor,
    is_deleted: false,
  })
}

const existingNames = new Set(existing.data.map((row) => row.name))
const inserts = rows.filter((row) => !existingNames.has(row.name))
if (inserts.length) {
  const saved = await db.from('event_goods').insert(inserts).select('id,name,image_url')
  if (saved.error) throw saved.error
}

const event = await db.from('events').select('source_urls').eq('id', eventId).single()
if (event.error) throw event.error
const sourceUrls = [...new Set([...(event.data.source_urls ?? []), koreanSource, goodsSource])]
const update = await db.from('events').update({ source_urls: sourceUrls, updated_by: editor }).eq('id', eventId)
if (update.error) throw update.error

console.log(JSON.stringify({ eventId, inserted: inserts.length, names: inserts.map((row) => row.name) }, null, 2))
