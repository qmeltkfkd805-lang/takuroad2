// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerWindBreakerLimitedPackage.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = '6b31a946-237c-4ffc-a093-dab1344ffa10'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.popcondplay.com/ip/news/view/525'

const { data: event, error: eventError } = await db
  .from('events')
  .select('*')
  .eq('id', eventId)
  .single()
if (eventError) throw eventError

const { data: goods, error: goodsError } = await db
  .from('event_goods')
  .select('*')
  .eq('event_id', eventId)
if (goodsError) throw goodsError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-windbreaker-limited-package-${stamp}.json`
await writeFile(backup, JSON.stringify({ event, goods }, null, 2), 'utf8')

const name = '전시회 한정 티셔츠 + 입장권 패키지'
const { data: duplicate, error: duplicateError } = await db
  .from('event_goods')
  .select('id')
  .eq('event_id', eventId)
  .eq('name', name)
  .eq('is_deleted', false)
  .maybeSingle()
if (duplicateError) throw duplicateError

let inserted = false
if (!duplicate) {
  const image = await readFile('scripts/work-menu-goods-images/windbreaker-official/official-4.jpg')
  const objectPath = `${eventId}/official-limited-tshirt-ticket-package.jpg`
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: eventId,
    name,
    kind: 'goods',
    price: null,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insertError) throw insertError
  inserted = true
}

const sourceUrls = [...new Set([...(event.source_urls ?? []), sourceUrl])]
const { error: updateError } = await db
  .from('events')
  .update({ source_urls: sourceUrls, updated_by: editorId })
  .eq('id', eventId)
if (updateError) throw updateError

console.log(JSON.stringify({ backup, inserted, sourceUrls }, null, 2))
