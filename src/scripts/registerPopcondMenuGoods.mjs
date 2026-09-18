// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerPopcondMenuGoods.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const imageDir = 'scripts/work-menu-goods-images/popcond'
const rows = [
  { eventId: 'ffa26041-dd27-430f-a29b-e10ee3a44ffb', name: '구매 특전 안내', price: null, filename: 'banpresto-1.jpg' },
  { eventId: 'ffa26041-dd27-430f-a29b-e10ee3a44ffb', name: '럭키 박스', price: 35000, filename: 'banpresto-2.jpg' },
  { eventId: '33ec13e3-7b51-4c8d-9b0f-78675afff6d9', name: '구매 금액별 특전 안내', price: null, filename: 'ghibli-2.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '굿즈 패키지 A', price: 25000, filename: 'peach-2.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '굿즈 패키지 B', price: 30000, filename: 'peach-3.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '굿즈 패키지 C', price: 48000, filename: 'peach-4.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '굿즈 패키지 D', price: 50000, filename: 'peach-5.jpg' },
  { eventId: '8ada9d9a-5778-4de4-a9cb-0f31503644dc', name: '구매 금액별 특전 안내', price: null, filename: 'peach-7.jpg' },
]

const eventIds = [...new Set(rows.map(row => row.eventId))]
const { data: before, error: beforeError } = await db.from('event_goods').select('*').in('event_id', eventIds)
if (beforeError) throw beforeError
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-popcond-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const results = []
for (const row of rows) {
  const { data: duplicate, error: duplicateError } = await db
    .from('event_goods').select('id').eq('event_id', row.eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicateError) throw duplicateError
  if (duplicate) {
    results.push({ ...row, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const objectPath = `${row.eventId}/official-popcond-${row.filename}`
  const image = await readFile(`${imageDir}/${row.filename}`)
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (uploadError) throw uploadError
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: row.eventId, name: row.name, kind: 'goods', price: row.price, image_url: publicData.publicUrl,
    created_by: editorId, updated_by: editorId,
  })
  if (insertError) throw insertError
  results.push({ ...row, status: 'INSERTED' })
}

console.log(JSON.stringify({ backup, inserted: results.filter(row => row.status === 'INSERTED').length, results }, null, 2))
