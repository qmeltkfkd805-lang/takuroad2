import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = '6b31a946-237c-4ffc-a093-dab1344ffa10'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.popcondplay.com/ip/news/view/525'

const { data: event, error: eventError } = await db
  .from('events')
  .select('*')
  .eq('id', eventId)
  .single()
if (eventError) throw eventError

const { data: goods, error: goodsError } = await db
  .from('event_goods')
  .select('*')
  .eq('event_id', eventId)
if (goodsError) throw goodsError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-windbreaker-limited-package-${stamp}.json`
await writeFile(backup, JSON.stringify({ event, goods }, null, 2), 'utf8')

const name = '전시회 한정 티셔츠 + 입장권 패키지'
const { data: duplicate, error: duplicateError } = await db
  .from('event_goods')
  .select('id')
  .eq('event_id', eventId)
  .eq('name', name)
  .eq('is_deleted', false)
  .maybeSingle()
if (duplicateError) throw duplicateError

let inserted = false
if (!duplicate) {
  const image = await readFile('scripts/work-menu-goods-images/windbreaker-official/official-4.jpg')
  const objectPath = `${eventId}/official-limited-tshirt-ticket-package.jpg`
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: eventId,
    name,
    kind: 'goods',
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insertError) throw insertError
  inserted = true
}

const sourceUrls = [...new Set([...(event.source_urls ?? []), sourceUrl])]
const { error: updateError } = await db
  .from('events')
  .update({ source_urls: sourceUrls, updated_by: editorId })
  .eq('id', eventId)
if (updateError) throw updateError

console.log(JSON.stringify({ backup, inserted, sourceUrls }, null, 2))
