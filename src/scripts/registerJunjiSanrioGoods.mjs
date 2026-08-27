import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.musinsa.com/content/1536204248620053199?contentCategoryCode=019002'
const eventIds = [
  'fcbf6b47-31c7-467e-b1e9-0b404fd6552c',
  'f87c2365-dd99-4b48-bd15-7cb05b9d44ff',
]
const rows = [
  { name: '토미에 × 헬로키티 미니 티셔츠 (화이트)', file: '01.jpg' },
  { name: '토미에 × 헬로키티 리본 티셔츠 (블랙)', file: '02.jpg' },
  { name: '토미에 × 헬로키티 티셔츠 (화이트)', file: '03.jpg' },
  { name: '토미에 × 폼폼푸린 긴팔 티셔츠 (옐로)', file: '04.jpg' },
  { name: '토미에 × 마이멜로디 미니 티셔츠 (핑크)', file: '05.jpg' },
  { name: '이토 준지 × 산리오캐릭터즈 빅빅 티셔츠 (그레이)', file: '06.jpg' },
]

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const allResults = []

for (const eventId of eventIds) {
  const eventResult = await db.from('events').select('*').eq('id', eventId).single()
  if (eventResult.error) throw eventResult.error
  const goodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
  if (goodsResult.error) throw goodsResult.error

  const eventBackup = `scripts/event-goods-backups/before-junji-sanrio-event-${eventId}-${stamp}.json`
  const goodsBackup = `scripts/event-goods-backups/before-junji-sanrio-goods-${eventId}-${stamp}.json`
  await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
  await writeFile(goodsBackup, JSON.stringify(goodsResult.data, null, 2), 'utf8')

  const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), sourceUrl])]
  const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', eventId)
  if (updateEvent.error) throw updateEvent.error

  const eventRows = []
  for (const row of rows) {
    const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
    if (duplicate.error) throw duplicate.error
    if (duplicate.data) {
      eventRows.push({ ...row, status: 'SKIPPED_DUPLICATE' })
      continue
    }

    const objectPath = `${eventId}/official-musinsa-${row.file}`
    const image = await readFile(`scripts/work-menu-goods-images/junji-sanrio/${row.file}`)
    const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
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
    eventRows.push({ ...row, status: 'INSERTED' })
  }
  allResults.push({ eventId, title: eventResult.data.title, eventBackup, goodsBackup, rows: eventRows })
}

console.log(JSON.stringify({ sourceUrl, results: allResults }, null, 2))
