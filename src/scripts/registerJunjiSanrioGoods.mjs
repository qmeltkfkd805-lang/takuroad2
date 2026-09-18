// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerJunjiSanrioGoods.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.musinsa.com/content/1536204248620053199?contentCategoryCode=019002'
const eventIds = [
  'fcbf6b47-31c7-467e-b1e9-0b404fd6552c',
  'f87c2365-dd99-4b48-bd15-7cb05b9d44ff',
]
const rows = [
  { name: '토미에 × 헬로키티 미니 티셔츠 (화이트)', file: '01.jpg' },
  { name: '토미에 × 헬로키티 리본 티셔츠 (블랙)', file: '02.jpg' },
  { name: '토미에 × 헬로키티 티셔츠 (화이트)', file: '03.jpg' },
  { name: '토미에 × 폼폼푸린 긴팔 티셔츠 (옐로)', file: '04.jpg' },
  { name: '토미에 × 마이멜로디 미니 티셔츠 (핑크)', file: '05.jpg' },
  { name: '이토 준지 × 산리오캐릭터즈 빅빅 티셔츠 (그레이)', file: '06.jpg' },
]

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const allResults = []

for (const eventId of eventIds) {
  const eventResult = await db.from('events').select('*').eq('id', eventId).single()
  if (eventResult.error) throw eventResult.error
  const goodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
  if (goodsResult.error) throw goodsResult.error

  const eventBackup = `scripts/event-goods-backups/before-junji-sanrio-event-${eventId}-${stamp}.json`
  const goodsBackup = `scripts/event-goods-backups/before-junji-sanrio-goods-${eventId}-${stamp}.json`
  await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
  await writeFile(goodsBackup, JSON.stringify(goodsResult.data, null, 2), 'utf8')

  const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), sourceUrl])]
  const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', eventId)
  if (updateEvent.error) throw updateEvent.error

  const eventRows = []
  for (const row of rows) {
    const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
    if (duplicate.error) throw duplicate.error
    if (duplicate.data) {
      eventRows.push({ ...row, status: 'SKIPPED_DUPLICATE' })
      continue
    }

    const objectPath = `${eventId}/official-musinsa-${row.file}`
    const image = await readFile(`scripts/work-menu-goods-images/junji-sanrio/${row.file}`)
    const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
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
    eventRows.push({ ...row, status: 'INSERTED' })
  }
  allResults.push({ eventId, title: eventResult.data.title, eventBackup, goodsBackup, rows: eventRows })
}

console.log(JSON.stringify({ sourceUrl, results: allResults }, null, 2))
