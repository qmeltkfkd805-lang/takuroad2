// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerOnePieceAndKimetsuGoods.mjs')
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
const batches = [
  {
    eventId: '57e9a311-c69c-4d16-9b5b-e94abb60fc63',
    key: 'onepiece',
    sourceUrls: [
      'https://www.instagram.com/p/Db5q2NqFKrB/',
      'https://www.instagram.com/p/Daui5GqCdP5/',
    ],
    rows: [
      { name: 'bemill 예매 특전 포토카드 안내', file: 'onepiece-bemill/onepiece-bemill-01.jpg' },
      { name: 'bemill 예매 특전 포토카드 10종', file: 'onepiece-bemill/onepiece-bemill-02.jpg' },
      { name: 'bemill 예매 특전 증정 조건', file: 'onepiece-bemill/onepiece-bemill-03.jpg' },
      { name: 'bemill 예매 특전 유의사항', file: 'onepiece-bemill/onepiece-bemill-04.jpg' },
      { name: 'WANTED 수배서 포토부스', file: 'onepiece-wanted/onepiece-wanted-01.jpg' },
      { name: 'WANTED 포토부스 프레임 5종', file: 'onepiece-wanted/onepiece-wanted-02.jpg' },
      { name: 'WANTED 포토부스 이용 방법', file: 'onepiece-wanted/onepiece-wanted-03.jpg' },
    ],
  },
  {
    eventId: '68482db1-ad67-4bf0-b766-e5527be2a504',
    key: 'kimetsu-md2',
    sourceUrls: ['https://www.instagram.com/p/DamEWurCZ2z/'],
    rows: [
      { name: '한국 전시 한정 MD 파트 2 - 아크릴 스탠드·에코백·숄더백', file: 'kimetsu-md-part2/kimetsu-md2-01.jpg' },
      { name: '한국 전시 한정 MD 파트 2 - 마우스패드·메탈 키링', file: 'kimetsu-md-part2/kimetsu-md2-02.jpg' },
    ],
  },
]

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const results = []

for (const batch of batches) {
  const eventResult = await db.from('events').select('*').eq('id', batch.eventId).single()
  if (eventResult.error) throw eventResult.error
  const goodsResult = await db.from('event_goods').select('*').eq('event_id', batch.eventId)
  if (goodsResult.error) throw goodsResult.error

  const eventBackup = `scripts/event-goods-backups/before-${batch.key}-event-${stamp}.json`
  const goodsBackup = `scripts/event-goods-backups/before-${batch.key}-goods-${stamp}.json`
  await writeFile(eventBackup, JSON.stringify(eventResult.data, null, 2), 'utf8')
  await writeFile(goodsBackup, JSON.stringify(goodsResult.data, null, 2), 'utf8')

  const sourceUrls = [...new Set([...(eventResult.data.source_urls ?? []), ...batch.sourceUrls])]
  const updateEvent = await db.from('events').update({ source_urls: sourceUrls }).eq('id', batch.eventId)
  if (updateEvent.error) throw updateEvent.error

  const batchResults = []
  for (const row of batch.rows) {
    const duplicate = await db.from('event_goods').select('id').eq('event_id', batch.eventId).eq('name', row.name).eq('is_deleted', false).maybeSingle()
    if (duplicate.error) throw duplicate.error
    if (duplicate.data) {
      batchResults.push({ ...row, status: 'SKIPPED_DUPLICATE' })
      continue
    }

    const objectPath = `${batch.eventId}/official-instagram-${row.file.replaceAll('/', '-')}`
    const image = await readFile(`scripts/work-menu-goods-images/${row.file}`)
    const upload = await db.storage.from('event-goods').upload(objectPath, image, { contentType: 'image/jpeg', upsert: true })
    if (upload.error) throw upload.error
    const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
    const inserted = await db.from('event_goods').insert({
      event_id: batch.eventId,
      name: row.name,
      kind: 'goods',
      price: null,
      image_url: publicData.publicUrl,
      created_by: editorId,
      updated_by: editorId,
    })
    if (inserted.error) throw inserted.error
    batchResults.push({ ...row, status: 'INSERTED' })
  }

  results.push({ eventId: batch.eventId, title: eventResult.data.title, eventBackup, goodsBackup, rows: batchResults })
}

console.log(JSON.stringify({ results }, null, 2))
