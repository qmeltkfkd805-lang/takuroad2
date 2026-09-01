import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = 'ff65ac67-068c-48ee-9b51-a794de97eb63'
const imageUrl = 'https://ouhlwmtwgxewrktgrzkd.supabase.co/storage/v1/object/public/event-goods/covers/2026/maplestory-in-lotteworld-busan-main.jpg'

const before = await db.from('event_goods').select('*').eq('event_id', eventId)
if (before.error) throw before.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-goods-backups/before-maplestory-lotte-busan-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const rows = [
  { name: '슬라임 크로스백 · 주황버섯 파우치 키링 등 롯데월드 부산 특별 굿즈', kind: 'goods' },
  { name: '메이플스토리 캐릭터 네 컷 사진 · 포토카드 자판기 · 캡슐토이', kind: 'goods' },
  { name: '빨간 포션 · 파란 포션 음료', kind: 'menu' },
  { name: '슬라임 솜사탕 · 주황버섯 초코치즈빵', kind: 'menu' },
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
    price: null,
    image_url: imageUrl,
    created_by: editor,
    updated_by: editor,
  }).select('id,name,kind').single()
  if (inserted.error) throw inserted.error
  results.push({ ...inserted.data, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
