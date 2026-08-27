import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = '752c61f4-b190-433b-974f-cc2d35fd909d'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sources = [
  'https://www.popcondplay.com/ip/news/view/664',
  'https://www.popcondplay.com/ip/news/view/666',
]
const rows = [
  ['goods', '팝업 한정 상품 · 토이류', null, 'goods/goods-2.jpg'],
  ['goods', '팝업 한정 상품 · 홈제품', null, 'goods/goods-3.jpg'],
  ['goods', '팝업 한정 상품 · 액세서리류', null, 'goods/goods-4.jpg'],
  ['goods', '팝업 한정 상품 · 문구류', null, 'goods/goods-5.jpg'],
  ['goods', '3만 원 이상 구매 리워드 · 럭키드로우', null, 'rewards/rewards-2.jpg'],
  ['goods', '10만 원 이상 구매 리워드 · 무민데이 에코백', null, 'rewards/rewards-3.jpg'],
  ['goods', '전사지·티셔츠 포함 3만 원 이상 구매 · 프레스 서비스', null, 'rewards/rewards-4.jpg'],
]

const { data: event, error: eventError } = await db.from('events').select('*').eq('id', eventId).single()
if (eventError) throw eventError
const { data: before, error: beforeError } = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeError) throw beforeError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-moomin-official-goods-${stamp}.json`
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

  const image = await readFile(`scripts/work-menu-goods-images/moomin-official/${filename}`)
  const objectPath = `${eventId}/official-${filename.replaceAll('/', '-')}`
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

const sourceUrls = [...new Set([...(event.source_urls ?? []), ...sources])]
const { error: updateError } = await db.from('events')
  .update({ source_urls: sourceUrls, updated_by: editorId }).eq('id', eventId)
if (updateError) throw updateError

console.log(JSON.stringify({ backup, inserted: results.filter(row => row.status === 'INSERTED').length, results, sourceUrls }, null, 2))
