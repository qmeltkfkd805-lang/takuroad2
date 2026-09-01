import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = 'a3b44c97-3b6a-4060-949e-348584090b9a'

const before = await db.from('event_goods').select('*').eq('event_id', eventId)
if (before.error) throw before.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-goods-backups/before-rent-a-girlfriend-benefits-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const menuGuide = before.data.find((row) => !row.is_deleted && row.name === '콜라보 메뉴·굿즈 안내')
const eventGuide = before.data.find((row) => !row.is_deleted && row.name === '메뉴 스탬프·해시태그 이벤트 안내')
if (!menuGuide || !eventGuide) throw new Error('기존 공식 안내 이미지를 찾지 못했습니다.')

const rows = [
  {
    name: '콜라보 메뉴 특전 · 캐릭터 코스터 전 10종',
    kind: 'goods',
    price: null,
    image_url: menuGuide.image_url,
  },
  {
    name: '해시태그 이벤트 특전 · 포스트카드 전 9종',
    kind: 'goods',
    price: null,
    image_url: eventGuide.image_url,
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
  }).select('id,name,kind,image_url').single()
  if (inserted.error) throw inserted.error
  results.push({ ...inserted.data, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
