import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const imageDir = 'scripts/work-menu-goods-images/x'

const sets = [
  {
    events: ['199cc2c8-371f-4c53-86b9-8d44010631d9', 'aa185e65-181f-4230-a336-7c085a60340a'],
    rows: [['menu', 'Gratte 메뉴·특전 안내', null, '2072893096359301366-1.jpg']],
  },
  {
    events: ['b201b5fd-fc48-4bc6-bc6b-b7c36f6d2371', '7a8d26e1-ffda-4a97-a41b-285e42d3997c'],
    rows: [['menu', 'Gratte 메뉴·특전 안내', null, '2075493439626747982-1.jpg']],
  },
  {
    events: ['00cf81a6-8d4e-45ca-a28b-912736eff26e', '058c0ed6-dbec-4eea-adfb-7282029c4b54'],
    rows: [['menu', 'Gratte 메뉴·특전 안내', null, '2080563636662378968-1.jpg']],
  },
  {
    events: ['82535339-150c-46f9-91d9-de5a341f4205', '92ad872c-3976-47cc-87bb-8b48d9c57859'],
    rows: [
      ['menu', 'Gratte 메뉴 안내', null, '2080488138162557358-1.jpg'],
      ['menu', '유상 특전 안내', 7500, '2080488138162557358-2.jpg'],
    ],
  },
  {
    events: ['8c2cf282-ad6f-4143-9884-3983baae86aa', '2cbb7b56-03bf-45ec-a0f3-2d6aeb8c72a3'],
    rows: [
      ['goods', '공식 굿즈 목록 1', null, '2077936325211336857-0.jpg'],
      ['goods', '공식 굿즈 목록 2', null, '2077936325211336857-1.jpg'],
      ['goods', '공식 굿즈 목록 3', null, '2077936325211336857-2.jpg'],
    ],
  },
  {
    events: ['85c620bc-e4ca-4782-99b3-06644771792c'],
    rows: [['goods', '굿즈 구매·현장 증정 특전 안내', null, '2082713951998259568-1.jpg']],
  },
  {
    events: ['a3b44c97-3b6a-4060-949e-348584090b9a'],
    rows: [
      ['menu', '콜라보 메뉴·굿즈 안내', null, '2087464109155754007-1.jpg'],
      ['menu', '메뉴 스탬프·해시태그 이벤트 안내', null, '2087464109155754007-2.jpg'],
    ],
  },
]

const eventIds = sets.flatMap(set => set.events)
const { data: before, error: beforeError } = await db.from('event_goods').select('*').in('event_id', eventIds)
if (beforeError) throw beforeError
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-official-x-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const results = []
for (const set of sets) {
  for (const eventId of set.events) {
    for (const [kind, name, price, filename] of set.rows) {
      const { data: duplicate, error: duplicateError } = await db
        .from('event_goods')
        .select('id')
        .eq('event_id', eventId)
        .eq('name', name)
        .eq('is_deleted', false)
        .maybeSingle()
      if (duplicateError) throw duplicateError
      if (duplicate) {
        results.push({ eventId, name, status: 'SKIPPED_DUPLICATE' })
        continue
      }

      const objectPath = `${eventId}/official-x-${filename}`
      const image = await readFile(`${imageDir}/${filename}`)
      const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
        contentType: 'image/jpeg', upsert: true,
      })
      if (uploadError) throw uploadError
      const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
      const { error: insertError } = await db.from('event_goods').insert({
        event_id: eventId, name, kind, price, image_url: publicData.publicUrl,
        created_by: editorId, updated_by: editorId,
      })
      if (insertError) throw insertError
      results.push({ eventId, name, kind, price, status: 'INSERTED' })
    }
  }
}

console.log(JSON.stringify({ backup, inserted: results.filter(r => r.status === 'INSERTED').length, results }, null, 2))
