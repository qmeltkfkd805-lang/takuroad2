import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const imageDir = 'scripts/work-menu-goods-images/fanding'

const sets = [
  {
    eventId: 'a51af964-7c00-45ab-8ecc-92c5498f1260',
    rows: [
      ['공식 굿즈 목록 1', 'conan-0.webp'],
      ['4만원 구매 특전', 'conan-1.webp'],
      ['7만원 구매 특전', 'conan-2.webp'],
      ['공식 굿즈 목록 2', 'conan-3.webp'],
      ['2만원 구매 특전', 'conan-4.webp'],
      ['공식 굿즈 목록 3', 'conan-5.webp'],
      ['공식 굿즈 목록 4', 'conan-6.webp'],
    ],
  },
  {
    eventId: '735ef920-b642-4f21-91f5-4e6e7e1869f4',
    rows: [
      ['1만원 구매 특전', 'yaiba-0.webp'],
      ['공식 굿즈 목록 1', 'yaiba-1.webp'],
      ['공식 굿즈 목록 2', 'yaiba-2.webp'],
    ],
  },
]

const eventIds = sets.map(set => set.eventId)
const { data: before, error: beforeError } = await db.from('event_goods').select('*').in('event_id', eventIds)
if (beforeError) throw beforeError
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-fanding-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const results = []
for (const set of sets) {
  for (const [name, filename] of set.rows) {
    const { data: duplicate, error: duplicateError } = await db
      .from('event_goods').select('id').eq('event_id', set.eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
    if (duplicateError) throw duplicateError
    if (duplicate) {
      results.push({ eventId: set.eventId, name, status: 'SKIPPED_DUPLICATE' })
      continue
    }
    const objectPath = `${set.eventId}/official-fanding-${filename}`
    const image = await readFile(`${imageDir}/${filename}`)
    const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
      contentType: 'image/webp', upsert: true,
    })
    if (uploadError) throw uploadError
    const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
    const { error: insertError } = await db.from('event_goods').insert({
      event_id: set.eventId, name, kind: 'goods', price: null, image_url: publicData.publicUrl,
      created_by: editorId, updated_by: editorId,
    })
    if (insertError) throw insertError
    results.push({ eventId: set.eventId, name, status: 'INSERTED' })
  }
}

console.log(JSON.stringify({ backup, inserted: results.filter(r => r.status === 'INSERTED').length, results }, null, 2))
