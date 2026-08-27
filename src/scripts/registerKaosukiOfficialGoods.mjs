import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = 'df97a040-eb90-4680-adf3-a83c44051dd4'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.ohmakestore.com/goods/goods_view.php?goodsNo=1000000290'
const imageUrl = 'https://godomall-storage.cdn-nhncommerce.com/010599ebbffabbe3ed1289dcaf535462/goods/1000000290/image/magnify/1000000290_magnify_094.png'

const { data: event, error: eventError } = await db.from('events').select('*').eq('id', eventId).single()
if (eventError) throw eventError
const { data: before, error: beforeError } = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeError) throw beforeError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-kaosuki-official-goods-${stamp}.json`
await writeFile(backup, JSON.stringify({ event, goods: before }, null, 2), 'utf8')

const name = '복제 원화'
const { data: duplicate, error: duplicateError } = await db.from('event_goods')
  .select('id').eq('event_id', eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
if (duplicateError) throw duplicateError

let status = 'SKIPPED_DUPLICATE'
if (!duplicate) {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`)
  const image = Buffer.from(await response.arrayBuffer())
  const objectPath = `${eventId}/official-reproduction-art.png`
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/png', upsert: true,
  })
  if (uploadError) throw uploadError
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: eventId,
    name,
    kind: 'goods',
    price: 330000,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insertError) throw insertError
  status = 'INSERTED'
}

const sourceUrls = [...new Set([...(event.source_urls ?? []), sourceUrl])]
const { error: updateError } = await db.from('events')
  .update({ source_urls: sourceUrls, updated_by: editorId }).eq('id', eventId)
if (updateError) throw updateError

console.log(JSON.stringify({ backup, status, sourceUrl }, null, 2))
