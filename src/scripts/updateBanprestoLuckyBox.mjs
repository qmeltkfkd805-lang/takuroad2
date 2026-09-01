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
await writeFile(`scripts/event-goods-backups/before-banpresto-lucky-box-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const row = before.data.find((item) => !item.is_deleted && item.name === '럭키 박스')
if (!row) throw new Error('럭키 박스 행을 찾지 못했습니다.')

const updated = await db.from('event_goods').update({
  name: '반프레스토 럭키박스 · 피규어 3~4개 / IP별 랜덤 구성 · 교환 불가',
  price: 35000,
  updated_by: editor,
  updated_at: new Date().toISOString(),
}).eq('id', row.id).select('id,name,price,image_url').single()
if (updated.error) throw updated.error

console.log(JSON.stringify(updated.data, null, 2))
