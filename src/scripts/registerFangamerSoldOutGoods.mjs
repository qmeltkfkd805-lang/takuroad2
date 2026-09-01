import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = '868b247e-7d6e-4a16-b690-a62c204d493d'
const sourceUrl = 'https://x.com/fangamer_popup/status/2094426986857083168'

const items = [
  { name: '언더테일 오리지널 사운드트랙 CD (전량 품절)', file: '01.jpg' },
  { name: '언더테일 그릴비 머그컵 (전량 품절)', file: '02.jpg' },
  { name: '스타듀밸리: 더 보드 게임 (전량 품절)', file: '03.jpg' },
  { name: '델타룬 더 비기닝 포스터 (전량 품절)', file: '04.jpg' },
  { name: '할로우 나이트 퀴렐 미니 피규어 (전량 품절)', file: '04.jpg' },
]

const existing = await db.from('event_goods').select('*').eq('event_id', eventId).eq('is_deleted', false)
if (existing.error) throw existing.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(
  `scripts/event-goods-backups/before-fangamer-soldout-${Date.now()}.json`,
  JSON.stringify({ eventId, sourceUrl, rows: existing.data }, null, 2),
)

const rows = []
for (const item of items) {
  const storagePath = `fangamer-summer-2026/soldout/${item.file}`
  const bytes = await readFile(`scripts/work-menu-goods-images/fangamer-soldout/${item.file}`)
  const upload = await db.storage.from('event-goods').upload(storagePath, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (upload.error) throw upload.error
  const imageUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl
  rows.push({
    event_id: eventId,
    name: item.name,
    kind: 'goods',
    price: null,
    image_url: imageUrl,
    created_by: editor,
    updated_by: editor,
    is_deleted: false,
  })
}

const existingNames = new Set(existing.data.map((row) => row.name))
const inserts = rows.filter((row) => !existingNames.has(row.name))
if (inserts.length) {
  const saved = await db.from('event_goods').insert(inserts).select('id,name,kind,price,image_url')
  if (saved.error) throw saved.error
}

const event = await db.from('events').select('source_urls').eq('id', eventId).single()
if (event.error) throw event.error
const sourceUrls = [...new Set([...(event.data.source_urls ?? []), sourceUrl])]
const updated = await db.from('events').update({ source_urls: sourceUrls, updated_by: editor }).eq('id', eventId)
if (updated.error) throw updated.error

console.log(JSON.stringify({ eventId, inserted: inserts.map((row) => row.name), sourceUrl }, null, 2))
