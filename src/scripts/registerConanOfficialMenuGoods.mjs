import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const imageDir = 'scripts/work-menu-goods-images/conan-official'
const boxEvent = 'c13a6759-7704-448b-9e65-ba4ac7b94241'
const windEvent = 'd3c23f98-6119-4c83-98d3-a82a83e1dd08'
const rows = [
  ...[0, 1, 2].map(index => ({ eventId: boxEvent, name: `빈티지 시즌 공식 메뉴 ${index + 1}`, filename: `boxmenu-${index}.jpg`, kind: 'menu' })),
  ...[0, 1, 2].map(index => ({ eventId: boxEvent, name: `공식 MD 목록 ${index + 1}`, filename: `boxmd-${index}.jpg`, kind: 'goods' })),
  ...[0, 1, 2].map(index => ({ eventId: windEvent, name: `1차 공식 상품 목록 ${index + 1}`, filename: `wind1-${index}.jpg`, kind: 'goods' })),
  ...[0, 1, 2].map(index => ({ eventId: windEvent, name: `2차 공식 상품 목록 ${index + 1}`, filename: `wind2-${index}.jpg`, kind: 'goods' })),
]

const eventIds = [...new Set(rows.map(row => row.eventId))]
const { data: before, error: beforeError } = await db.from('event_goods').select('*').in('event_id', eventIds)
if (beforeError) throw beforeError
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-conan-official-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const results = []
for (const row of rows) {
  const { data: duplicate, error: duplicateError } = await db.from('event_goods')
    .select('id').eq('event_id', row.eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicateError) throw duplicateError
  if (duplicate) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const objectPath = `${row.eventId}/official-conan-${row.filename}`
  const image = await readFile(`${imageDir}/${row.filename}`)
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (uploadError) throw uploadError
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: row.eventId, name: row.name, kind: row.kind, price: null, image_url: publicData.publicUrl,
    created_by: editorId, updated_by: editorId,
  })
  if (insertError) throw insertError
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({ backup, inserted: results.filter(row => row.status === 'INSERTED').length, results }, null, 2))
