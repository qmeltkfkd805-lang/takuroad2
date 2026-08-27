import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = 'fa848fda-a8cd-4275-8293-d4c3dc2051f1'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.instagram.com/p/DcOB1CqSXxz/'

const eventResult = await db.from('events').select('*').eq('id', eventId).single()
if (eventResult.error) throw eventResult.error
const beforeGoodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeGoodsResult.error) throw beforeGoodsResult.error

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const eventBackup = `scripts/event-goods-backups/before-dragonball-bemill-event-${stamp}.json`
const goodsBackup = `scripts/event-goods-backups/before-dragonball-bemill-goods-${stamp}.json`
await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
await writeFile(goodsBackup, JSON.stringify(beforeGoodsResult.data, null, 2), 'utf8')

const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), sourceUrl])]
const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', eventId)
if (updateEvent.error) throw updateEvent.error

const name = 'bemill 예매 특전 포토카드 13종'
const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
if (duplicate.error) throw duplicate.error

let status = 'SKIPPED_DUPLICATE'
if (!duplicate.data) {
  const objectPath = `${eventId}/official-instagram-bemill-photocard.jpg`
  const image = await readFile('scripts/work-menu-goods-images/dragonball-rise/bemill-photocard.jpg')
  const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)

  const inserted = await db.from('event_goods').insert({
    event_id: eventId,
    name,
    kind: 'goods',
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (inserted.error) throw inserted.error
  status = 'INSERTED'
}

console.log(JSON.stringify({ eventId, sourceUrl, eventBackup, goodsBackup, name, status }, null, 2))
