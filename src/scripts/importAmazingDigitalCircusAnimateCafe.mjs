// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : importAmazingDigitalCircusAnimateCafe.mjs')
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
const title = 'The Amazing Digital Circus × 애니메이트 카페'
const source = 'https://x.com/animatecafe_js/status/2093262323020333334'
const posterSource = 'https://pbs.twimg.com/media/HQdUdnWbEAA0-0W.jpg?name=orig'

const existing = await db.from('events').select('*').or('title.ilike.%Amazing Digital Circus%,title.ilike.%어메이징 디지털 서커스%,title.ilike.%어메이징디지털서커스%')
if (existing.error) throw existing.error
const tag = await db.from('tags').select('*').or('name.ilike.%어메이징 디지털 서커스%,english_name.ilike.%Amazing Digital Circus%').limit(1).maybeSingle()
if (tag.error) throw tag.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-amazing-digital-circus-cafe-${Date.now()}.json`, JSON.stringify({ events: existing.data, tag: tag.data }, null, 2))

let eventTag = tag.data
if (!eventTag) {
  const created = await db.from('tags').insert({
    name: '어메이징 디지털 서커스', slug: 'the-amazing-digital-circus', english_name: 'The Amazing Digital Circus',
    ip_type: '애니메이션', genres: ['코미디', '판타지', '블랙 코미디'],
    description: 'GLITCH Productions가 제작한 독립 웹 애니메이션 시리즈입니다.',
    official_url: 'https://www.glitchprod.com/digital-circus', youtube_url: 'https://www.youtube.com/@GLITCH', created_by: editor,
  }).select('*').single()
  if (created.error) throw created.error
  eventTag = created.data
}

const posterResponse = await fetch(posterSource)
if (!posterResponse.ok) throw new Error(`Poster download failed: ${posterResponse.status}`)
const posterPath = 'event-posters/amazing-digital-circus-animate-cafe-jamsil-2026.jpg'
const upload = await db.storage.from('event-goods').upload(posterPath, Buffer.from(await posterResponse.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const template = await db.from('events').select('place_id,place_name,place_addr,place_lat,place_lng,parking,parking_note').eq('id', 'af91b699-2b6a-440d-bd64-60747e54d6a4').single()
if (template.error) throw template.error
const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, { open: '10:00', close: '21:00' }]))
const payload = {
  tag_id: eventTag.id, type: 'collab_cafe', title,
  start_date: '2026-11-13', end_date: '2026-12-08', reserve_start: null, reserve_end: null,
  entry_info: null,
  description: '웹 애니메이션 「The Amazing Digital Circus」의 캐릭터와 세계관을 테마로 진행되는 공식 콜라보 카페입니다.\n\n작품 특유의 화려한 디지털 서커스 분위기를 오프라인 카페 공간에서 만날 수 있습니다.',
  cover_url: coverUrl,
  ...template.data,
  place_detail: 'B1F 애니메이트 카페 잠실롯데점',
  hours,
  hours_info: '매일 10:00~21:00\n라스트오더 20:30',
  source_urls: [source, 'https://x.com/animatecafe_js', 'https://www.glitchprod.com/digital-circus'],
  ticket_urls: [], updated_by: editor, updated_at: new Date().toISOString(),
}
const duplicate = await db.from('events').select('id').eq('title', title).eq('start_date', payload.start_date).maybeSingle()
if (duplicate.error) throw duplicate.error
const saved = duplicate.data
  ? await db.from('events').update(payload).eq('id', duplicate.data.id).select('*').single()
  : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
if (saved.error) throw saved.error

console.log(JSON.stringify({ status: duplicate.data ? 'UPDATED' : 'INSERTED', eventId: saved.data.id, title, pending: ['입장 방식', '예약 기간과 URL', '한국 공식 메뉴·굿즈·특전 이미지'] }, null, 2))

