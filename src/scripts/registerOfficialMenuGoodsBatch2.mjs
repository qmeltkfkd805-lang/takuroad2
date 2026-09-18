// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerOfficialMenuGoodsBatch2.mjs')
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
const rows = [
  ...[7, 0, 4, 5].map((index, order) => ({
    eventId: '28446011-b942-45a2-bda1-2c062ded4b35',
    name: `공식 콜라보 카페 메뉴 안내 ${order + 1}`,
    price: null,
    path: `scripts/work-menu-goods-images/priconne-official/menu-${index}.png`,
    contentType: 'image/png',
  })),
  ...[4, 3, 6, 5].map((index, order) => ({
    eventId: '28446011-b942-45a2-bda1-2c062ded4b35',
    name: `공식 MD 목록 ${order + 1}`,
    price: null,
    path: `scripts/work-menu-goods-images/priconne-official/md-${index}.png`,
    contentType: 'image/png',
  })),
  {
    eventId: 'b025baaa-095c-4d40-b379-709e6f691f07',
    name: '1차 공식 상품 소개',
    price: null,
    path: 'scripts/work-menu-goods-images/official-batch2/pokemon-products.jpg',
    contentType: 'image/jpeg',
  },
  {
    eventId: 'fd84bc75-11e8-4424-a250-ce8f6b6c168b',
    name: '공식 신규 MD 및 구매 특전 안내',
    price: null,
    path: 'scripts/work-menu-goods-images/official-batch2/ourguild-md.jpg',
    contentType: 'image/jpeg',
  },
]

const eventIds = [...new Set(rows.map(row => row.eventId))]
const { data: before, error: beforeError } = await db.from('event_goods').select('*').in('event_id', eventIds)
if (beforeError) throw beforeError
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-official-batch2-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const results = []
for (const [index, row] of rows.entries()) {
  const { data: duplicate, error: duplicateError } = await db.from('event_goods')
    .select('id').eq('event_id', row.eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
  if (duplicateError) throw duplicateError
  if (duplicate) {
    results.push({ name: row.name, eventId: row.eventId, status: 'SKIPPED_DUPLICATE' })
    continue
  }
  const extension = row.contentType === 'image/png' ? 'png' : 'jpg'
  const objectPath = `${row.eventId}/official-batch2-${index + 1}.${extension}`
  const image = await readFile(row.path)
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: row.contentType,
    upsert: true,
  })
  if (uploadError) throw uploadError
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: row.eventId,
    name: row.name,
    kind: 'goods',
    price: row.price,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insertError) throw insertError
  results.push({ name: row.name, eventId: row.eventId, status: 'INSERTED' })
}

console.log(JSON.stringify({ backup, inserted: results.filter(row => row.status === 'INSERTED').length, results }, null, 2))
