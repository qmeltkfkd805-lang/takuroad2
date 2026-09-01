import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = '6be375a8-c902-46a3-b2a3-4d5d19219bee'

const products = [
  {
    name: '「주간 소년 점프」 로고 티셔츠 · BLACK / WHITE · L / XL / XXL',
    price: 51200,
    source: 'https://jumpshop-benelic.com/cdn/shop/files/SEOUL_T.jpg?v=1787286692',
    path: 'goods/2026/jump-shop-seoul-3-logo-tshirt.jpg',
  },
  {
    name: '「주간 소년 점프」 로고 아크릴 키홀더',
    price: 19200,
    source: 'https://jumpshop-benelic.com/cdn/shop/files/keychain.png?v=1775104250',
    path: 'goods/2026/jump-shop-seoul-3-logo-keyholder.png',
  },
  {
    name: '『ONE PIECE』 다이컷 스티커 서울',
    price: 8000,
    source: 'https://jumpshop-benelic.com/cdn/shop/files/sticker_7b80a453-e005-44ce-b1f9-896fe8a1092c.png?v=1775104250',
    path: 'goods/2026/jump-shop-seoul-3-one-piece-sticker.png',
  },
  {
    name: '방문객 특전 · 랜덤 증정 / 재고 소진 시 종료',
    price: null,
    source: 'https://jumpshop-benelic.com/cdn/shop/files/3b7005d677fd05cbb425d64ff013e69f.jpg?v=1787286792',
    path: 'goods/2026/jump-shop-seoul-3-visitor-benefit.jpg',
  },
  {
    name: '2만원 이상 구매 특전 · 스티커 전 16종 중 랜덤 1매',
    price: null,
    source: 'https://jumpshop-benelic.com/cdn/shop/files/bd1aadda41603aed8bedaa3571185344.jpg?v=1787724263',
    path: 'goods/2026/jump-shop-seoul-3-purchase-benefit.jpg',
  },
]

for (const product of products) {
  const response = await fetch(product.source)
  if (!response.ok) throw new Error(`image download failed: ${response.status} ${product.source}`)
  const contentType = response.headers.get('content-type') || (product.path.endsWith('.png') ? 'image/png' : 'image/jpeg')
  const upload = await db.storage.from('event-goods').upload(product.path, Buffer.from(await response.arrayBuffer()), {
    contentType,
    upsert: true,
  })
  if (upload.error) throw upload.error
  product.image_url = db.storage.from('event-goods').getPublicUrl(product.path).data.publicUrl
}

await mkdir('scripts/event-goods-backups', { recursive: true })
const beforeGoods = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeGoods.error) throw beforeGoods.error
await writeFile(`scripts/event-goods-backups/before-jump-shop-seoul-3-${Date.now()}.json`, JSON.stringify(beforeGoods.data, null, 2))

const beforeEvent = await db.from('events').select('*').eq('id', eventId).single()
if (beforeEvent.error) throw beforeEvent.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-jump-shop-seoul-3-source-${Date.now()}.json`, JSON.stringify(beforeEvent.data, null, 2))

const officialPage = 'https://jumpshop-benelic.com/pages/korea'
const sourceUrls = [...new Set([officialPage, ...(beforeEvent.data.source_urls || [])])]
const eventUpdate = await db.from('events').update({ source_urls: sourceUrls, updated_by: editor, updated_at: new Date().toISOString() }).eq('id', eventId)
if (eventUpdate.error) throw eventUpdate.error

const results = []
for (const { source, path, ...product } of products) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', product.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ name: product.name, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const inserted = await db.from('event_goods').insert({
    ...product,
    event_id: eventId,
    kind: 'goods',
    created_by: editor,
    updated_by: editor,
  }).select('id,name,price,image_url').single()
  if (inserted.error) throw inserted.error
  results.push({ ...inserted.data, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, officialPageAdded: !beforeEvent.data.source_urls?.includes(officialPage), inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
