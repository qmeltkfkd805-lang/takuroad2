// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : importStrangeDreamSigningEvent.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = '꿈자리가 이상한데요?! 외전 발매 기념 흰귀 작가님 사인회'
const officialUrl = 'https://m.animate-onlineshop.co.kr/board/view.php?bdId=event&sno=486&noheader=y'
const applicationUrl = 'https://www.animate-onlineshop.co.kr/goods/goods_view.php?goodsNo=1000093860'
const posterUrl = 'http://animate.godohosting.com/data/goods/editor/260814/655fbde22fea84ba08794a9567ecd177_141644.jpg'

const existing = await db.from('events').select('*').eq('title', title).eq('start_date', '2026-11-14').maybeSingle()
if (existing.error) throw existing.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-strange-dream-signing-${Date.now()}.json`, JSON.stringify(existing.data, null, 2))

let tag = await db.from('tags').select('*').eq('slug', 'strange-dream').maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) {
  tag = await db.from('tags').insert({
    name: '꿈자리가 이상한데요?!', slug: 'strange-dream', ip_type: '웹툰', genres: ['BL', '로맨스'],
    description: '흰귀 작가의 웹툰 「꿈자리가 이상한데요?!」.', official_url: officialUrl,
  }).select('*').single()
  if (tag.error) throw tag.error
}
const place = await db.from('places').select('*').eq('id', '6c9bad49-7a5b-43d3-b2df-405a2e5df390').single()
if (place.error) throw place.error

const image = await fetch(posterUrl)
if (!image.ok) throw new Error(`Official poster download failed ${image.status}`)
const storagePath = 'covers/2026/strange-dream-heengui-signing-main.jpg'
const upload = await db.storage.from('event-goods').upload(storagePath, Buffer.from(await image.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const record = {
  tag_id: tag.data.id, type: 'official_event', title,
  start_date: '2026-11-14', end_date: '2026-11-14', reserve_start: '2026-08-19', reserve_end: '2026-09-16',
  entry_info: '사전응모 후 추첨\n당첨자만 입장',
  description: '「꿈자리가 이상한데요?!」 외전 발매를 기념해 흰귀 작가와 만나는 비공개 사인회입니다. 대상 상품을 온라인샵에서 단독 주문하면 자동 응모되며, 본인 인증을 마친 계정당 1회만 참여할 수 있습니다.\n\n당첨자 본인만 참석할 수 있고 실물 신분증 확인이 진행됩니다. 사인은 별도로 준비된 사인지에만 받을 수 있으며, 행사 중 개인 촬영은 불가합니다.',
  cover_url: coverUrl,
  place_id: place.data.id, place_name: place.data.name, place_addr: place.data.addr, place_lat: place.data.lat, place_lng: place.data.lng,
  place_detail: '5층 애니메이트 홍대점', parking: place.data.parking, parking_note: place.data.parking_note,
  hours: null, hours_info: '행사 시간은 당첨자 안내 메일로 개별 공지',
  source_urls: [officialUrl], ticket_urls: [{ url: applicationUrl, label: '사인회 응모하기' }],
  updated_by: editor, updated_at: new Date().toISOString(),
}
const result = existing.data
  ? await db.from('events').update(record).eq('id', existing.data.id).select('*').single()
  : await db.from('events').insert(record).select('*').single()
if (result.error) throw result.error
console.log(JSON.stringify({ status: existing.data ? 'UPDATE' : 'INSERT', event: result.data, tag: tag.data }, null, 2))
