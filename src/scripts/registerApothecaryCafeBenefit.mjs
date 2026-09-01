import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventIds = [
  'b201b5fd-fc48-4bc6-bc6b-b7c36f6d2371',
  '7a8d26e1-ffda-4a97-a41b-285e42d3997c',
]
const name = '관련 상품·그라떼·유상 특전 15,000원 구매당 비주얼 카드 전 7종 중 랜덤 1장'
const imageUrl = 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/4c2a9c81f69e8e38248078e1a771ff27_180531.jpg'

await mkdir('scripts/event-goods-backups', { recursive: true })
const results = []
for (const eventId of eventIds) {
  const before = await db.from('event_goods').select('*').eq('event_id', eventId)
  if (before.error) throw before.error
  await writeFile(`scripts/event-goods-backups/before-apothecary-cafe-benefit-${eventId}-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ eventId, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const inserted = await db.from('event_goods').insert({
    event_id: eventId,
    name,
    kind: 'goods',
    price: null,
    image_url: imageUrl,
    created_by: editor,
    updated_by: editor,
  }).select('id,name,image_url').single()
  if (inserted.error) throw inserted.error
  results.push({ eventId, ...inserted.data, status: 'INSERTED' })
}

console.log(JSON.stringify({ inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
