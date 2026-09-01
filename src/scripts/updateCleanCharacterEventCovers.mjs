import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventIds = [
  'b201b5fd-fc48-4bc6-bc6b-b7c36f6d2371',
  '7a8d26e1-ffda-4a97-a41b-285e42d3997c',
  '874b0fce-938d-4283-940b-b54e9c67c799',
  'fa8f897e-8bd6-4117-bc09-e03effeb51ef',
]
const sourceUrl = 'https://kusuriyanohitorigoto.jp/season2/gallery/aprilfool_260401_bubbles_1.php'

const before = await db.from('events').select('id,title,cover_url,source_urls').in('id', eventIds)
if (before.error) throw before.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(
  `scripts/event-backups/before-clean-character-covers-${Date.now()}.json`,
  JSON.stringify(before.data, null, 2),
)

const storagePath = 'covers/2026/apothecary-aprilfool-bubbles-clean-vertical.jpg'
const upload = await db.storage.from('event-goods').upload(
  storagePath,
  await readFile('scripts/work-event-covers/apothecary-aprilfool-bubbles-clean.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const results = []
for (const event of before.data) {
  const sourceUrls = [...new Set([...(event.source_urls ?? []), sourceUrl])]
  const saved = await db.from('events').update({
    cover_url: coverUrl,
    source_urls: sourceUrls,
    updated_by: editor,
    updated_at: new Date().toISOString(),
  }).eq('id', event.id).select('id,title,cover_url').single()
  if (saved.error) throw saved.error
  results.push(saved.data)
}

console.log(JSON.stringify({ coverUrl, updated: results }, null, 2))
