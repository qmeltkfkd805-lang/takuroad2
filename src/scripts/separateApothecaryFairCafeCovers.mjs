import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const fairIds = [
  '874b0fce-938d-4283-940b-b54e9c67c799',
  'fa8f897e-8bd6-4117-bc09-e03effeb51ef',
]
const sourceUrl = 'https://kusuriyanohitorigoto.jp/season2/gallery/aprilfool_260401_edelglanz_1.php'

const before = await db.from('events').select('id,title,type,cover_url,source_urls').in('id', fairIds)
if (before.error) throw before.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-separate-apothecary-fair-covers-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const storagePath = 'covers/2026/apothecary-aprilfool-edelglanz-clean-vertical.jpg'
const upload = await db.storage.from('event-goods').upload(
  storagePath,
  await readFile('scripts/work-event-covers/apothecary-aprilfool-edelglanz-clean.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const updated = []
for (const event of before.data) {
  const result = await db.from('events').update({
    cover_url: coverUrl,
    source_urls: [...new Set([...(event.source_urls ?? []), sourceUrl])],
    updated_by: editor,
    updated_at: new Date().toISOString(),
  }).eq('id', event.id).select('id,title,type,cover_url').single()
  if (result.error) throw result.error
  updated.push(result.data)
}

console.log(JSON.stringify({ updated }, null, 2))
