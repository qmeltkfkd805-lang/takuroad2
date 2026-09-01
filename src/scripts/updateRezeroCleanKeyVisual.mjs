import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventIds = [
  '887a3cc3-2d88-4ef0-967f-8cc36b86cc5f',
  'e12cc7a5-99be-4e7b-8ed0-ad0a52fd6c09',
  'de622d7c-f7e8-489f-9411-e833d0d3bd81',
  'ebdc6eaa-e429-4311-b0ae-3fb26c0f61e0',
]
const sourceUrl = 'https://x.com/Rezero_official/status/2067252676136468753'

const before = await db.from('events').select('id,title,cover_url,source_urls').in('id', eventIds)
if (before.error) throw before.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-rezero-clean-keyvisual-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const storagePath = 'covers/2026/re-zero-4th-regain-clean-keyvisual.jpg'
const upload = await db.storage.from('event-goods').upload(
  storagePath,
  await readFile('scripts/work-event-covers/rezero-4th-regain-clean.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const results = []
for (const event of before.data) {
  const saved = await db.from('events').update({
    cover_url: coverUrl,
    source_urls: [...new Set([...(event.source_urls ?? []), sourceUrl])],
    updated_by: editor,
    updated_at: new Date().toISOString(),
  }).eq('id', event.id).select('id,title,cover_url').single()
  if (saved.error) throw saved.error
  results.push(saved.data)
}

console.log(JSON.stringify({ coverUrl, updated: results }, null, 2))
