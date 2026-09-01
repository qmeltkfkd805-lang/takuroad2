import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = '33ec13e3-7b51-4c8d-9b0f-78675afff6d9'
const oldName = '구매 금액별 특전 안내'

const before = await db.from('event_goods').select('*').eq('event_id', eventId)
if (before.error) throw before.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-goods-backups/before-ghibli-jeju-benefit-split-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const oldRow = before.data.find((row) => !row.is_deleted && row.name === oldName)
if (!oldRow) throw new Error('기존 구매 금액별 특전 안내 행을 찾지 못했습니다.')

const removed = await db.from('event_goods').update({
  is_deleted: true,
  updated_by: editor,
  updated_at: new Date().toISOString(),
}).eq('id', oldRow.id)
if (removed.error) throw removed.error

const rows = [
  {
    name: '1만원 이상 구매 특전 · 마녀 배달부 키키 지지 × 제주 동백꽃 한정 아트워크 엽서',
    kind: 'goods',
    price: null,
    image_url: oldRow.image_url,
  },
  {
    name: '5만원 이상 구매 특전 · 이웃집 토토로 × 제주 수국 한정 아트워크 러기지택',
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
