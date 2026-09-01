import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = '6c646f28-2da7-4d32-b248-52a19e12bbe5'
const imageUrl = 'https://ouhlwmtwgxewrktgrzkd.supabase.co/storage/v1/object/public/event-goods/covers/2026/sanrio-mermaid-aquarium.jpg'

const before = await db.from('event_goods').select('*').eq('event_id', eventId)
if (before.error) throw before.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-goods-backups/before-sanrio-mermaid-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const rows = [
  { name: '머메이드 산리오캐릭터즈 봉제인형 키링', kind: 'goods' },
  { name: '랜덤 캔뱃지 · 키캡 키링 · 컬래버 티셔츠 · 캐릭터 스티커', kind: 'goods' },
  { name: '아쿠아샵 산리오캐릭터즈 굿즈 70종 이상', kind: 'goods' },
  { name: '산리오캐릭터즈 테마 소프트 아이스크림 · 베리 초코 프라페', kind: 'menu' },
  { name: '마이멜로디 · 한교동 달고나', kind: 'menu' },
  { name: 'AR 미션 완료 특전 · 랜덤 ID카드 키링', kind: 'goods' },
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
