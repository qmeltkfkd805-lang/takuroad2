import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventIds = [
  '8be154d4-78b2-4d47-92b4-da86ea72f1b0',
  'fe1237d2-0c9f-427c-81e1-64e940744567',
]

const images = [
  {
    local: 'scripts/work-menu-goods-images/inuyasha-official/official-2.jpg',
    path: 'goods/2026/inuyasha-popup-desk-goods-official.jpg',
  },
  {
    local: 'scripts/work-menu-goods-images/inuyasha-official/official-3.jpg',
    path: 'goods/2026/inuyasha-popup-acrylic-stand-official.jpg',
  },
]

for (const image of images) {
  const upload = await db.storage.from('event-goods').upload(image.path, await readFile(image.local), {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (upload.error) throw upload.error
  image.publicUrl = db.storage.from('event-goods').getPublicUrl(image.path).data.publicUrl
}

const rows = [
  { name: '사혼의 구슬 캔배지 · 랜덤 8종', price: 6000, image_url: images[1].publicUrl },
  { name: '캐릭터 카드 · 랜덤 12종 / 1팩 2매', price: 5000, image_url: images[1].publicUrl },
  { name: '네컷 필름 · 랜덤 8종', price: 4000, image_url: images[1].publicUrl },
  { name: '에마 키링 · 랜덤 8종', price: 11000, image_url: images[1].publicUrl },
  { name: '사혼의 구슬 부적 키링 · 반구 스마트톡', price: null, image_url: images[1].publicUrl },
  { name: '페어·캐릭터·스프링 아크릴 스탠드', price: null, image_url: images[1].publicUrl },
  { name: '키보드 커버 · 데스크 장패드 · 마우스패드 · 풍혈 멀티 클리너', price: null, image_url: images[0].publicUrl },
  { name: '2만원 구매당 캐릭터 코스터 랜덤 1매 증정 · 영수증 합산 불가', price: null, image_url: images[0].publicUrl },
]

await mkdir('scripts/event-goods-backups', { recursive: true })
const results = []
for (const eventId of eventIds) {
  const before = await db.from('event_goods').select('*').eq('event_id', eventId)
  if (before.error) throw before.error
  await writeFile(`scripts/event-goods-backups/before-inuyasha-${eventId}-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

  for (const row of rows) {
    const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
    if (duplicate.error) throw duplicate.error
    if (duplicate.data) {
      results.push({ eventId, name: row.name, status: 'SKIPPED_DUPLICATE' })
      continue
    }
    const inserted = await db.from('event_goods').insert({
      ...row,
      event_id: eventId,
      kind: 'goods',
      created_by: editor,
      updated_by: editor,
    }).select('id,name').single()
    if (inserted.error) throw inserted.error
    results.push({ eventId, ...inserted.data, status: 'INSERTED' })
  }
}

console.log(JSON.stringify({ uploaded: images.map(({ path, publicUrl }) => ({ path, publicUrl })), inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
