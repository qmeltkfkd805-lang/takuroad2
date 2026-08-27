import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = 'a023555b-8dc8-4c4a-9d50-7a284c6d685b'
const name = 'bemill 예매 특전 투명 포토카드 10종'

const { data: before, error: beforeError } = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeError) throw beforeError
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-apothecary-benefit-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
if (duplicate.error) throw duplicate.error
if (duplicate.data) {
  console.log(JSON.stringify({ backup, status: 'SKIPPED_DUPLICATE', eventId, name }, null, 2))
  process.exit(0)
}

const objectPath = `${eventId}/official-bemill-clear-photocard-benefit.png`
const image = await readFile('scripts/work-menu-goods-images/apothecary/img-3.png')
const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/png', upsert: true })
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

console.log(JSON.stringify({ backup, status: 'INSERTED', eventId, name, imageUrl: publicData.publicUrl }, null, 2))
