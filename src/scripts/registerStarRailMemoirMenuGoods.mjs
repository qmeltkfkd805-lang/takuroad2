import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventId = 'f4ead4d4-ce20-4f6c-8518-dd3b65e0cb2d'
const row = {
  name: '전시 한정 굿즈 20종 목록',
  filename: 'limited-goods-list.png',
}

const { data: before, error: beforeError } = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeError) throw beforeError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-starrail-memoir-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const { data: duplicate, error: duplicateError } = await db.from('event_goods')
  .select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
if (duplicateError) throw duplicateError

let status = 'SKIPPED_DUPLICATE'
if (!duplicate) {
  const objectPath = `${eventId}/official-hoyolab-${row.filename}`
  const image = await readFile(`scripts/work-menu-goods-images/starrail-memoir/${row.filename}`)
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/png',
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: eventId,
    name: row.name,
    kind: 'goods',
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insertError) throw insertError
  status = 'INSERTED'
}

console.log(JSON.stringify({ backup, status, row }, null, 2))
