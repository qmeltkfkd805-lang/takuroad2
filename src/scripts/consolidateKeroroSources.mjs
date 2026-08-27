import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = 'c0920feb-0d05-49c9-b247-e7fa73257378'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrls = [
  'https://www.instagram.com/substreet__/',
  'https://www.hdc-iparkmall.com/main/webrender.do',
]

const { data: before, error: selectError } = await db.from('events').select('*').eq('id', eventId).single()
if (selectError) throw selectError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-keroro-source-consolidation-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const { data: updated, error: updateError } = await db.from('events')
  .update({ source_urls: sourceUrls, updated_by: editorId })
  .eq('id', eventId)
  .select('id,title,source_urls')
  .single()
if (updateError) throw updateError

console.log(JSON.stringify({ backup, updated }, null, 2))
