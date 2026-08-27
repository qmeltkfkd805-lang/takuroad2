import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventIds = [
  'd7af2161-436f-448d-b922-8bcd900c14ad',
  '6b5856e7-8b7c-4f0a-b8ae-a78c752ecba9',
]
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://shop.aniplustv.com/offline-shop/collabo-cafe?collaboId=109'
const imageDir = 'scripts/work-menu-goods-images/waterside-night-official'
const rows = [
  ['menu', '콜라보 카페 메뉴', null, 'detail-2.png'],
  ['menu', '5~8주차 카페 이용 특전', null, 'detail-3.png'],
  ['menu', '스페셜 메뉴 · 태주의 사랑 가득 아야한컵죽', 24000, 'detail-4.png'],
  ['goods', '굿즈 구매 특전', null, 'detail-5.png'],
  ['goods', '공식 굿즈 목록', null, 'detail-6.png'],
]

const { data: events, error: eventsError } = await db.from('events').select('*').in('id', eventIds)
if (eventsError) throw eventsError
const { data: before, error: beforeError } = await db.from('event_goods').select('*').in('event_id', eventIds)
if (beforeError) throw beforeError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-waterside-night-official-goods-${stamp}.json`
await writeFile(backup, JSON.stringify({ events, goods: before }, null, 2), 'utf8')

const results = []
for (const eventId of eventIds) {
  for (const [kind, name, price, filename] of rows) {
    const { data: duplicate, error: duplicateError } = await db.from('event_goods')
      .select('id').eq('event_id', eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
    if (duplicateError) throw duplicateError
    if (duplicate) {
      results.push({ eventId, name, status: 'SKIPPED_DUPLICATE' })
      continue
    }

    const image = await readFile(`${imageDir}/${filename}`)
    const objectPath = `${eventId}/official-${filename}`
    const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
      contentType: 'image/png', upsert: true,
    })
    if (uploadError) throw uploadError
    const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
    const { error: insertError } = await db.from('event_goods').insert({
      event_id: eventId, name, kind, price, image_url: publicData.publicUrl,
      created_by: editorId, updated_by: editorId,
    })
    if (insertError) throw insertError
    results.push({ eventId, name, status: 'INSERTED' })
  }

  const event = events.find(item => item.id === eventId)
  const sourceUrls = [...new Set([...(event?.source_urls ?? []), sourceUrl])]
  const { error: updateError } = await db.from('events')
    .update({ source_urls: sourceUrls, updated_by: editorId }).eq('id', eventId)
  if (updateError) throw updateError
}

console.log(JSON.stringify({ backup, inserted: results.filter(row => row.status === 'INSERTED').length, results }, null, 2))
