// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerHaikyuuCafeGoods.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = '9cb2cbd9-2545-4096-ba9c-0271d2c76b82'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sources = [
  'https://x.com/animatecafe_kor/status/2082941127050592403',
  'https://x.com/animatecafe_kor/status/2082769525699903863',
  'https://x.com/animatecafe_kor/status/2083115449487687960',
  'https://x.com/animatecafe_kor/status/2083116382175302117',
]

const eventResult = await db.from('events').select('*').eq('id', eventId).single()
if (eventResult.error) throw eventResult.error
const goodsResult = await db.from('event_goods').select('*').eq('event_id', eventId)
if (goodsResult.error) throw goodsResult.error

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const eventBackup = `scripts/event-goods-backups/before-haikyuu-event-${stamp}.json`
const goodsBackup = `scripts/event-goods-backups/before-haikyuu-goods-${stamp}.json`
await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
await writeFile(goodsBackup, JSON.stringify(goodsResult.data, null, 2), 'utf8')

const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), ...sources])]
const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', eventId)
if (updateEvent.error) throw updateEvent.error

const rows = [
  { name: '하이큐!! 콜라보 굿즈', kind: 'goods', file: 'goods.jpg' },
  { name: '하이큐!! 콜라보 메뉴 1', kind: 'menu', file: 'menu-1.jpg' },
  { name: '하이큐!! 콜라보 메뉴 2', kind: 'menu', file: 'menu-2.jpg' },
  { name: '하이큐!! 콜라보 메뉴 3', kind: 'menu', file: 'menu-3.jpg' },
  { name: '하이큐!! 콜라보 메뉴 4', kind: 'menu', file: 'menu-4.jpg' },
  { name: '5만원 이상 구매 미니등신대 추첨 특전', kind: 'goods', file: 'lottery.jpg' },
  { name: '구매 금액별 카페 한정 특전 1', kind: 'goods', file: 'benefit-1.jpg' },
  { name: '구매 금액별 카페 한정 특전 2', kind: 'goods', file: 'benefit-2.jpg' },
]

const results = []
for (const row of rows) {
  const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicate.error) throw duplicate.error
  if (duplicate.data) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }

  const objectPath = `${eventId}/official-x-${row.file}`
  const image = await readFile(`scripts/work-menu-goods-images/haikyuu/${row.file}`)
  const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const insert = await db.from('event_goods').insert({
    event_id: eventId,
    name: row.name,
    kind: row.kind,
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insert.error) throw insert.error
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({ eventId, eventBackup, goodsBackup, sources, results }, null, 2))
