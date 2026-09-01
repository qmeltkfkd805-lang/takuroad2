import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = 'ffa26041-dd27-430f-a29b-e10ee3a44ffb'

const before = await db.from('event_goods').select('*').eq('event_id', eventId)
if (before.error) throw before.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-goods-backups/before-banpresto-benefit-split-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const oldRow = before.data.find((row) => !row.is_deleted && row.name === '구매 특전 안내')
if (!oldRow) throw new Error('기존 구매 특전 안내 행을 찾지 못했습니다.')

const removed = await db.from('event_goods').update({
  is_deleted: true,
  updated_by: editor,
  updated_at: new Date().toISOString(),
}).eq('id', oldRow.id)
if (removed.error) throw removed.error

const rows = [
  {
    name: '치비구루미 상품 2개 이상 구매 특전 · 치비구루미 PVC 백',
    kind: 'goods',
    price: null,
    image_url: oldRow.image_url,
  },
  {
    name: '반프레스토 피규어 구매 + 공식 SNS 팔로우 특전 · 반프레스토 클리어파일',
    kind: 'goods',
    price: null,
    image_url: oldRow.image_url,
  },
]

const results = []
for (const row of rows) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ name: row.name, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const inserted = await db.from('event_goods').insert({
    ...row,
    event_id: eventId,
    created_by: editor,
    updated_by: editor,
  }).select('id,name,image_url').single()
  if (inserted.error) throw inserted.error
  results.push({ ...inserted.data, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, removedGenericRow: oldRow.id, inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
