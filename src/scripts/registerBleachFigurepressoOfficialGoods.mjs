import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = 'a409e6e2-abd7-4cc6-8c9b-b9459ec8868e'
const officialPage = 'https://m.figurepresso.com/article/%EC%9D%B4%EB%B2%A4%ED%8A%B8%EC%86%8C%EC%8B%9D/8/132369/'

const files = [
  ['bleach_promo_01-1.jpg', 'bleach-figurepresso-menu-1.jpg'],
  ['bleach_promo_01-2.jpg', 'bleach-figurepresso-menu-2.jpg'],
  ['bleach_promo_01-3.jpg', 'bleach-figurepresso-menu-3.jpg'],
  ['bleach_promo_05-1.jpg', 'bleach-figurepresso-md-1.jpg'],
  ['bleach_promo_05-2.jpg', 'bleach-figurepresso-md-2.jpg'],
  ['bleach_promo_04.jpg', 'bleach-figurepresso-event-benefit.jpg'],
]

const images = []
for (const [localName, storageName] of files) {
  const storagePath = `goods/2026/${storageName}`
  const upload = await db.storage.from('event-goods').upload(
    storagePath,
    await readFile(`scripts/work-menu-goods-images/bleach-figurepresso/${localName}`),
    { contentType: 'image/jpeg', upsert: true },
  )
  if (upload.error) throw upload.error
  images.push(db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl)
}

const eventBefore = await db.from('events').select('*').eq('id', eventId).single()
if (eventBefore.error) throw eventBefore.error
const goodsBefore = await db.from('event_goods').select('*').eq('event_id', eventId)
if (goodsBefore.error) throw goodsBefore.error
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = Date.now()
await writeFile(`scripts/event-goods-backups/before-bleach-figurepresso-event-${stamp}.json`, JSON.stringify(eventBefore.data, null, 2))
await writeFile(`scripts/event-goods-backups/before-bleach-figurepresso-goods-${stamp}.json`, JSON.stringify(goodsBefore.data, null, 2))

const sourceUrls = [...new Set([...(eventBefore.data.source_urls ?? []), officialPage])]
const eventUpdate = await db.from('events').update({
  source_urls: sourceUrls,
  description: 'TV 애니메이션 「블리치 천년혈전편」을 주제로 진행되는 공식 콜라보 카페입니다.\n\n콜라보 메뉴와 공식 MD, 방문 이벤트가 함께 운영됩니다. 품목별 판매 및 특전 재고는 현장 상황에 따라 조기 소진될 수 있습니다.',
  updated_by: editor,
}).eq('id', eventId).select('id,title,source_urls,description').single()
if (eventUpdate.error) throw eventUpdate.error

const rows = [
  { name: '블리치 천년혈전편 콜라보 메뉴 안내 ①', kind: 'menu', image_url: images[0] },
  { name: '블리치 천년혈전편 콜라보 메뉴 안내 ②', kind: 'menu', image_url: images[1] },
  { name: '블리치 천년혈전편 콜라보 메뉴 안내 ③', kind: 'menu', image_url: images[2] },
  { name: '블리치 천년혈전편 공식 MD 리스트 ①', kind: 'goods', image_url: images[3] },
  { name: '블리치 천년혈전편 공식 MD 리스트 ②', kind: 'goods', image_url: images[4] },
  { name: '블리치 천년혈전편 방문 이벤트·특전 안내', kind: 'goods', image_url: images[5] },
]

const results = []
for (const row of rows) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ name: row.name, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const inserted = await db.from('event_goods').insert({
    ...row,
    event_id: eventId,
    price: null,
    created_by: editor,
    updated_by: editor,
  }).select('id,name,kind,image_url').single()
  if (inserted.error) throw inserted.error
  results.push({ ...inserted.data, status: 'INSERTED' })
}

console.log(JSON.stringify({ event: eventUpdate.data, uploaded: images.length, inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
