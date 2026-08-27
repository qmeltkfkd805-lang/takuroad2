import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = 'c0920feb-0d05-49c9-b247-e7fa73257378'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrlsToAdd = [
  'https://www.instagram.com/p/DccscGsIyRu/',
  'https://www.instagram.com/p/DccsWOkI3Vv/',
]

const rows = [
  { name: '기존 MD 인형·마스코트 라인업', file: 'keroro-md-existing/existing-01.jpg' },
  { name: '기존 MD 스티커 라인업 1', file: 'keroro-md-existing/existing-02.jpg' },
  { name: '기존 MD 스티커 라인업 2', file: 'keroro-md-existing/existing-03.jpg' },
  { name: '기존 MD 문구류 라인업 1', file: 'keroro-md-existing/existing-04.jpg' },
  { name: '기존 MD 문구류 라인업 2', file: 'keroro-md-existing/existing-05.jpg' },
  { name: '기존 MD 차량용 스티커·버튼 배지', file: 'keroro-md-existing/existing-06.jpg' },
  { name: '기존 MD 메모지·미니 파우치·네임 태그', file: 'keroro-md-existing/existing-07.jpg' },
  { name: '기존 MD 카드·마우스패드 라인업', file: 'keroro-md-existing/existing-08.jpg' },
  { name: '기존 MD 마스킹테이프·키체인', file: 'keroro-md-existing/existing-09.jpg' },
  { name: '오리지널 MD 액자·쿠션·키링', file: 'keroro-md-original/original-01.jpg' },
  { name: '오리지널 MD 포토카드 홀더·핀버튼·캘린더·스탠드', file: 'keroro-md-original/original-02.jpg' },
]

const eventResult = await db.from('events').select('*').eq('id', eventId).single()
if (eventResult.error) throw eventResult.error
const goodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
if (goodsResult.error) throw goodsResult.error

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const eventBackup = `scripts/event-goods-backups/before-keroro-md-event-${stamp}.json`
const goodsBackup = `scripts/event-goods-backups/before-keroro-md-goods-${stamp}.json`
await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
await writeFile(goodsBackup, JSON.stringify(goodsResult.data, null, 2), 'utf8')

const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), ...sourceUrlsToAdd])]
const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', eventId)
if (updateEvent.error) throw updateEvent.error

const results = []
for (const row of rows) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }

  const objectPath = `${eventId}/official-instagram-${row.file.replaceAll('/', '-')}`
  const image = await readFile(`scripts/work-menu-goods-images/${row.file}`)
  const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)

  const inserted = await db.from('event_goods').insert({
    event_id: eventId,
    name: row.name,
    kind: 'goods',
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (inserted.error) throw inserted.error
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, sourceUrlsToAdd, eventBackup, goodsBackup, results }, null, 2))
