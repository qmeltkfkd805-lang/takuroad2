// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerEnsembleTicketGoods.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = '5080fc62-2a49-4426-a886-92cb25a833ac'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://x.com/MofunOffline/status/2092162648041529664'

const eventResult = await db.from('events').select('*').eq('id', eventId).single()
if (eventResult.error) throw eventResult.error
const goodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
if (goodsResult.error) throw goodsResult.error

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const eventBackup = `scripts/event-goods-backups/before-ensemble-ticket-event-${stamp}.json`
const goodsBackup = `scripts/event-goods-backups/before-ensemble-ticket-goods-${stamp}.json`
await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
await writeFile(goodsBackup, JSON.stringify(goodsResult.data, null, 2), 'utf8')

const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), sourceUrl])]
const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', eventId)
if (updateEvent.error) throw updateEvent.error

const rows = [
  { name: '앙상블스타즈!! 기념 티켓 상품 안내', file: '01.jpg', contentType: 'image/jpeg' },
  { name: '앙상블스타즈!! 기념 티켓 디자인 1', file: '02.png', contentType: 'image/png' },
  { name: '앙상블스타즈!! 기념 티켓 디자인 2', file: '03.png', contentType: 'image/png' },
  { name: '앙상블스타즈!! 기념 티켓 디자인 3', file: '04.png', contentType: 'image/png' },
]

const results = []
for (const row of rows) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const objectPath = `${eventId}/official-x-ticket-${row.file}`
  const image = await readFile(`scripts/work-menu-goods-images/ensemble-tickets/${row.file}`)
  const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: row.contentType, upsert: true })
  if (upload.error) throw upload.error
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const insert = await db.from('event_goods').insert({
    event_id: eventId,
    name: row.name,
    kind: 'goods',
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insert.error) throw insert.error
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, sourceUrl, eventBackup, goodsBackup, results }, null, 2))
