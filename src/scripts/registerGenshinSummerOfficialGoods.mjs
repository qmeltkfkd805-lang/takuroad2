import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = 'd8c2a9e5-50bf-4528-a27b-52ef02153ec0'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.instagram.com/p/Db2pH93sLDe/'
const imageDir = 'scripts/work-menu-goods-images/genshin-summer-recovered'
const rows = [
  ['goods', '한여름 파티 공식 굿즈 목록 1', null, 'official-post-1.jpg'],
  ['goods', '한여름 파티 공식 굿즈 목록 2', null, 'official-post-2.jpg'],
  ['goods', '한여름 파티 공식 굿즈 목록 3', null, 'official-post-3.jpg'],
  ['goods', '한여름 파티 공식 굿즈 목록 4', null, 'official-post-4.jpg'],
  ['goods', '한여름 파티 구매 특전 안내', null, 'official-post-5.jpg'],
]

const { data: event, error: eventError } = await db.from('events').select('*').eq('id', eventId).single()
if (eventError) throw eventError
const { data: before, error: beforeError } = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeError) throw beforeError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-genshin-summer-official-goods-${stamp}.json`
await writeFile(backup, JSON.stringify({ event, goods: before }, null, 2), 'utf8')

const results = []
for (const [kind, name, price, filename] of rows) {
  const { data: duplicate, error: duplicateError } = await db.from('event_goods')
    .select('id').eq('event_id', eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
  if (duplicateError) throw duplicateError
  if (duplicate) {
    results.push({ name, status: 'SKIPPED_DUPLICATE' })
    continue
  }

  const image = await readFile(`${imageDir}/${filename}`)
  const objectPath = `${eventId}/official-${filename}`
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (uploadError) throw uploadError
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: eventId, name, kind, price, image_url: publicData.publicUrl,
    created_by: editorId, updated_by: editorId,
  })
  if (insertError) throw insertError
  results.push({ name, status: 'INSERTED' })
}

const sourceUrls = [...new Set([...(event.source_urls ?? []), sourceUrl])]
const { error: updateError } = await db.from('events')
  .update({ source_urls: sourceUrls, updated_by: editorId }).eq('id', eventId)
if (updateError) throw updateError

console.log(JSON.stringify({ backup, inserted: results.filter(row => row.status === 'INSERTED').length, results, sourceUrls }, null, 2))
