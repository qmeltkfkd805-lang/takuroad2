// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : importGxg2026.mjs')
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
const title = 'GXG 2026 (Game culture X Generation 2026)'
const officialUrl = 'https://gxg.world/about'

const existing = await db.from('events').select('*').eq('title', title).eq('start_date', '2026-09-11').maybeSingle()
if (existing.error) throw existing.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-gxg-2026-${Date.now()}.json`, JSON.stringify(existing.data, null, 2))

let place = await db.from('places').select('*').eq('slug', 'pangyo-station').maybeSingle()
if (place.error) throw place.error
if (!place.data) {
  const kakao = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('판교역')}`, {
    headers: { Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_KEY}` },
  })
  if (!kakao.ok) throw new Error(`Kakao place search failed ${kakao.status}`)
  const found = (await kakao.json()).documents.find((row) => row.place_name === '판교역(경기)')
  if (!found) throw new Error('판교역 장소 검색 결과를 찾지 못했습니다.')
  place = await db.from('places').insert({
    slug: 'pangyo-station', name: '판교역', place_type: 'CULTURE_SPACE',
    addr: found.road_address_name || found.address_name, region: '경기', district: '성남시 분당구',
    lat: Number(found.y), lng: Number(found.x), kakao_place_id: found.id, category_name: found.category_name,
    parking: false, parking_note: '행사 전용 주차장 없음\n판교역 인근 유료 주차장 이용',
  }).select('*').single()
  if (place.error) throw place.error
}

let tag = await db.from('tags').select('*').eq('slug', 'gxg').maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) {
  tag = await db.from('tags').insert({
    name: 'GXG', slug: 'gxg', ip_type: '게임 문화 축제', genres: ['게임', '공연', '전시', '체험'],
    description: '게임 음악·아트·스토리·퍼포먼스를 함께 다루는 도심형 게임문화축제.', official_url: 'https://gxg.world/',
  }).select('*').single()
  if (tag.error) throw tag.error
}

const posterUrl = 'https://gxg.world/static/media/aboutPoster.26e6b7ee5de9a8aa3190.jpg'
const image = await fetch(posterUrl)
if (!image.ok) throw new Error(`Official poster download failed ${image.status}`)
const storagePath = 'covers/2026/gxg-2026-main-poster.jpg'
const upload = await db.storage.from('event-goods').upload(storagePath, Buffer.from(await image.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const record = {
  tag_id: tag.data.id, type: 'official_event', title,
  start_date: '2026-09-11', end_date: '2026-09-12', reserve_start: null, reserve_end: null,
  entry_info: '무료 입장\n현장 선착순 관람',
  description: '게임 음악과 아트, 스토리, 퍼포먼스를 한자리에서 즐기는 도심형 게임문화축제입니다. 게임음악 경연대회와 콘서트, 게임 브랜드 체험존, 인디게임·대학생 게임 전시 등이 판교역 일대에서 진행됩니다.\n\n일부 체험과 프로그램은 현장 운영 상황에 따라 대기 또는 조기 마감될 수 있습니다.',
  cover_url: coverUrl,
  place_id: place.data.id, place_name: place.data.name, place_addr: place.data.addr, place_lat: place.data.lat, place_lng: place.data.lng,
  place_detail: '판교역 광장·판교 콘텐츠 거리 및 인근 행사장',
  parking: false, parking_note: '행사 전용 주차장 없음\n판교역 인근 유료 주차장 이용',
  hours: { fri: { open: '13:00', close: '22:00' }, sat: { open: '13:00', close: '22:00' } },
  hours_info: '9월 11일 13:00~22:00\n9월 12일 13:00~22:00\n프로그램별 시간 상이',
  source_urls: [officialUrl, 'https://gxg.world/schedule', 'https://gxg.world/location'], ticket_urls: [],
  updated_by: editor, updated_at: new Date().toISOString(),
}
const result = existing.data
  ? await db.from('events').update(record).eq('id', existing.data.id).select('*').single()
  : await db.from('events').insert(record).select('*').single()
if (result.error) throw result.error
console.log(JSON.stringify({ status: existing.data ? 'UPDATE' : 'INSERT', event: result.data, place: place.data }, null, 2))
