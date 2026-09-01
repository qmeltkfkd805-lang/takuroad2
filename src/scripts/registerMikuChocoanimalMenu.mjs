import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = '4c433b45-79d5-473a-b2d8-df4636f1ee37'

const existing = await db.from('event_goods').select('*').eq('event_id', eventId).eq('is_deleted', false)
if (existing.error) throw existing.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(
  `scripts/event-goods-backups/before-miku-chocoanimal-menu-${Date.now()}.json`,
  JSON.stringify({ eventId, rows: existing.data }, null, 2),
)

const name = 'Chocoanimal Miku Wagon 공식 콜라보 메뉴'
const duplicate = existing.data.find((row) => row.name === name && row.kind === 'menu')
if (!duplicate) {
  const source = existing.data.find((row) => row.name === 'Chocoanimal Miku Wagon 공식 메뉴·굿즈 안내')
  if (!source?.image_url) throw new Error('공식 메뉴·굿즈 안내 이미지를 찾지 못했습니다.')
  const saved = await db.from('event_goods').insert({
    event_id: eventId,
    name,
    kind: 'menu',
    price: null,
    image_url: source.image_url,
    created_by: editor,
    updated_by: editor,
    is_deleted: false,
  }).select('id,name,kind,image_url').single()
  if (saved.error) throw saved.error
  console.log(JSON.stringify({ inserted: saved.data }, null, 2))
} else {
  console.log(JSON.stringify({ skipped: duplicate.id, reason: 'already exists' }, null, 2))
}
