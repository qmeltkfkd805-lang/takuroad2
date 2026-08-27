import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventIds = [
  'fcbf6b47-31c7-467e-b1e9-0b404fd6552c',
  'f87c2365-dd99-4b48-bd15-7cb05b9d44ff',
]
const rows = [
  { name: '토미에 × 헬로키티 스퀘어 파우치', file: 'square-pouch.jpg' },
  { name: '토미에 × 헬로키티 포토카드 홀더', file: 'photocard-holder.jpg' },
  { name: '이토 준지 × 산리오캐릭터즈 우산', file: 'umbrella.jpg' },
  { name: '토미에 × 헬로키티 손거울', file: 'mirror.jpg' },
  { name: '토미에 × 헬로키티 파우치 키체인', file: 'pouch-keychain.jpg' },
  { name: '토미에 × 헬로키티 북 파우치', file: 'book-pouch.jpg' },
  { name: '토미에 × 헬로키티 L자 파일 홀더', file: 'l-file-holder.jpg' },
  { name: '이토 준지 × 산리오캐릭터즈 핀 배지 VER.1', file: 'pin-badges-v1.jpg' },
]

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const results = []

for (const eventId of eventIds) {
  const eventResult = await db.from('events').select('id,title').eq('id', eventId).single()
  if (eventResult.error) throw eventResult.error
  const goodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
  if (goodsResult.error) throw goodsResult.error
  const backup = `scripts/event-goods-backups/before-junji-accessories-${eventId}-${stamp}.json`
  await writeFile(backup, JSON.stringify(goodsResult.data, null, 2), 'utf8')

  const eventRows = []
  for (const row of rows) {
    const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
    if (duplicate.error) throw duplicate.error
    if (duplicate.data) {
      eventRows.push({ ...row, status: 'SKIPPED_DUPLICATE' })
      continue
    }
    const objectPath = `${eventId}/official-musinsa-accessory-${row.file}`
    const image = await readFile(`scripts/work-menu-goods-images/junji-sanrio-accessories/${row.file}`)
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
  results.push({ eventId, title: eventResult.data.title, backup, rows: eventRows })
}

console.log(JSON.stringify({ results }, null, 2))

