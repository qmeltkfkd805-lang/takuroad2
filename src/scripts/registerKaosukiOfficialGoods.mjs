// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerKaosukiOfficialGoods.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventId = 'df97a040-eb90-4680-adf3-a83c44051dd4'
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceUrl = 'https://www.ohmakestore.com/goods/goods_view.php?goodsNo=1000000290'
const imageUrl = 'https://godomall-storage.cdn-nhncommerce.com/010599ebbffabbe3ed1289dcaf535462/goods/1000000290/image/magnify/1000000290_magnify_094.png'

const { data: event, error: eventError } = await db.from('events').select('*').eq('id', eventId).single()
if (eventError) throw eventError
const { data: before, error: beforeError } = await db.from('event_goods').select('*').eq('event_id', eventId)
if (beforeError) throw beforeError

await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-kaosuki-official-goods-${stamp}.json`
await writeFile(backup, JSON.stringify({ event, goods: before }, null, 2), 'utf8')

const name = '복제 원화'
const { data: duplicate, error: duplicateError } = await db.from('event_goods')
  .select('id').eq('event_id', eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
if (duplicateError) throw duplicateError

let status = 'SKIPPED_DUPLICATE'
if (!duplicate) {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`)
  const image = Buffer.from(await response.arrayBuffer())
  const objectPath = `${eventId}/official-reproduction-art.png`
  const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
    contentType: 'image/png', upsert: true,
  })
  if (uploadError) throw uploadError
  const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
  const { error: insertError } = await db.from('event_goods').insert({
    event_id: eventId,
    name,
    kind: 'goods',
    price: 330000,
    image_url: publicData.publicUrl,
    created_by: editorId,
    updated_by: editorId,
  })
  if (insertError) throw insertError
  status = 'INSERTED'
}

const sourceUrls = [...new Set([...(event.source_urls ?? []), sourceUrl])]
const { error: updateError } = await db.from('events')
  .update({ source_urls: sourceUrls, updated_by: editorId }).eq('id', eventId)
if (updateError) throw updateError

console.log(JSON.stringify({ backup, status, sourceUrl }, null, 2))
