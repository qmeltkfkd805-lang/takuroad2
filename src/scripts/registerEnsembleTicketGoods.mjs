import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = '5080fc62-2a49-4426-a886-92cb25a833ac'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://x.com/MofunOffline/status/2092162648041529664'

const eventResult = await db.from('events').select('*').eq('id', eventId).single()
if (eventResult.error) throw eventResult.error
const goodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
if (goodsResult.error) throw goodsResult.error

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const eventBackup = `scripts/event-goods-backups/before-ensemble-ticket-event-${stamp}.json`
const goodsBackup = `scripts/event-goods-backups/before-ensemble-ticket-goods-${stamp}.json`
await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
await writeFile(goodsBackup, JSON.stringify(goodsResult.data, null, 2), 'utf8')

const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), sourceUrl])]
const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', eventId)
if (updateEvent.error) throw updateEvent.error

const rows = [
  { name: '앙상블스타즈!! 기념 티켓 상품 안내', file: '01.jpg', contentType: 'image/jpeg' },
  { name: '앙상블스타즈!! 기념 티켓 디자인 1', file: '02.png', contentType: 'image/png' },
  { name: '앙상블스타즈!! 기념 티켓 디자인 2', file: '03.png', contentType: 'image/png' },
  { name: '앙상블스타즈!! 기념 티켓 디자인 3', file: '04.png', contentType: 'image/png' },
]

const results = []
for (const row of rows) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const objectPath = `${eventId}/official-x-ticket-${row.file}`
  const image = await readFile(`scripts/work-menu-goods-images/ensemble-tickets/${row.file}`)
  const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: row.contentType, upsert: true })
  if (upload.error) throw upload.error
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const insert = await db.from('event_goods').insert({
    event_id: eventId,
    name: row.name,
    kind: 'goods',
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insert.error) throw insert.error
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, sourceUrl, eventBackup, goodsBackup, results }, null, 2))
