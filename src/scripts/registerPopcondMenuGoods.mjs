import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const imageDir = 'scripts/work-menu-goods-images/popcond'
const rows = [
  { eventId: 'ffa26041-dd27-430f-a29b-e10ee3a44ffb', name: '구매 특전 안내', price: null, filename: 'banpresto-1.jpg' },
  { eventId: 'ffa26041-dd27-430f-a29b-e10ee3a44ffb', name: '럭키 박스', price: 35000, filename: 'banpresto-2.jpg' },
  { eventId: '33ec13e3-7b51-4c8d-9b0f-78675afff6d9', name: '구매 금액별 특전 안내', price: null, filename: 'ghibli-2.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '굿즈 패키지 A', price: 25000, filename: 'peach-2.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '굿즈 패키지 B', price: 30000, filename: 'peach-3.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '굿즈 패키지 C', price: 48000, filename: 'peach-4.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '굿즈 패키지 D', price: 50000, filename: 'peach-5.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '구매 금액별 특전 안내', price: null, filename: 'peach-7.jpg' },
]

const eventIds = [...new Set(rows.map(row => row.eventId))]
const { data: before, error: beforeError } = await db.from('event_goods').select('*').in('event_id', eventIds)
if (beforeError) throw beforeError
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-popcond-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const results = []
for (const row of rows) {
  const { data: duplicate, error: duplicateError } = await db
    .from('event_goods').select('id').eq('event_id', row.eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicateError) throw duplicateError
  if (duplicate) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const objectPath = `${row.eventId}/official-popcond-${row.filename}`
  const image = await readFile(`${imageDir}/${row.filename}`)
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (uploadError) throw uploadError
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: row.eventId, name: row.name, kind: 'goods', price: row.price, image_url: publicData.publicUrl,
    created_by: editorId, updated_by: editorId,
  })
  if (insertError) throw insertError
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({ backup, inserted: results.filter(row => row.status === 'INSERTED').length, results }, null, 2))
