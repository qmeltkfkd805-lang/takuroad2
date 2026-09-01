import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = '483903a1-b59f-4894-a3af-b21a1211dc65'

const before = await db.from('event_goods').select('*').eq('event_id', eventId)
if (before.error) throw before.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-goods-backups/before-taeha-room-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const rows = [
  {
    name: '공식 MD 60종 안내 · 신규 아크릴스탠드·인형·쿠션 27종 / 기존 인기 굿즈 25종 / 단행본 8종',
    kind: 'goods',
    image_url: 'https://ouhlwmtwgxewrktgrzkd.supabase.co/storage/v1/object/public/event-goods/covers/2026/taeha-room-withered-flower-main.jpg',
  },
  {
    name: '현장 키오스크 한정 포토카드 17종 · 가챠존 랜덤 굿즈',
    kind: 'goods',
    image_url: 'https://ouhlwmtwgxewrktgrzkd.supabase.co/storage/v1/object/public/event-goods/covers/2026/taeha-room-withered-flower-main.jpg',
  },
  {
    name: '구매 금액별 캐릭터 프로필 티켓 · 럭키드로우 · 사전예약자 한정 특전',
    kind: 'goods',
    image_url: 'https://ouhlwmtwgxewrktgrzkd.supabase.co/storage/v1/object/public/event-goods/covers/2026/taeha-room-withered-flower-main.jpg',
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
  const inserted = await db.from('event_goods').insert({ ...row, event_id: eventId, price: null, created_by: editor, updated_by: editor }).select('*').single()
  if (inserted.error) throw inserted.error
  results.push({ name: row.name, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
