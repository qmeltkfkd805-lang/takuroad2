import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = 'c0920feb-0d05-49c9-b247-e7fa73257378'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.instagram.com/p/DccshNDoz5U/'

const eventResult = await db.from('events').select('*').eq('id', eventId).single()
if (eventResult.error) throw eventResult.error
const beforeGoodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeGoodsResult.error) throw beforeGoodsResult.error

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const eventBackup = `scripts/event-goods-backups/before-keroro-benefits-event-${stamp}.json`
const goodsBackup = `scripts/event-goods-backups/before-keroro-benefits-goods-${stamp}.json`
await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
await writeFile(goodsBackup, JSON.stringify(beforeGoodsResult.data, null, 2), 'utf8')

const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), sourceUrl])]
const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', eventId)
if (updateEvent.error) throw updateEvent.error

const rows = [
  { name: '스페셜 MD 구매 특전 안내', file: '780127525.jpg' },
  { name: '스페셜 MD 구매 특전 상세 1', file: '779787481.jpg' },
  { name: '스페셜 MD 구매 특전 상세 2', file: '783509296.jpg' },
]

const results = []
for (const row of rows) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }

  const objectPath = `${eventId}/official-instagram-keroro-benefit-${row.file}`
  const image = await readFile(`scripts/work-menu-goods-images/keroro-subst/${row.file}`)
  const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)

  const inserted = await db.from('event_goods').insert({
    event_id: eventId,
    name: row.name,
    kind: 'goods',
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (inserted.error) throw inserted.error
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, sourceUrl, eventBackup, goodsBackup, results }, null, 2))
