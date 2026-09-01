import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const source = 'https://x.com/animatecafe_kor/status/2086739343679603108'
const workSource = 'https://x.com/REDICE_STUDIO'
const posterSource = 'https://pbs.twimg.com/media/HPWKRSIakAAwvQJ.jpg?name=orig'
const bookingUrl = 'https://booking.naver.com/booking/12/bizes/1049489'

const existing = await db.from('events').select('*').or('title.ilike.%전지적 독자 시점%애니메이트%,title.ilike.%전독시%애니메이트%')
if (existing.error) throw existing.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-orv-animate-cafe-2026-${Date.now()}.json`, JSON.stringify({ events: existing.data }, null, 2))

const tag = await db.from('tags').select('*').or('name.eq.전지적 독자 시점,slug.eq.omniscient-reader').limit(1).maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) throw new Error('전지적 독자 시점 태그를 찾지 못했습니다.')

const posterResponse = await fetch(posterSource)
if (!posterResponse.ok) throw new Error(`Poster download failed: ${posterResponse.status}`)
const posterPath = 'event-posters/orv-animate-cafe-2026.jpg'
const upload = await db.storage.from('event-goods').upload(posterPath, Buffer.from(await posterResponse.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const templates = await db.from('events').select('id,place_id,place_name,place_addr,place_lat,place_lng,parking,parking_note').in('id', [
  '82535339-150c-46f9-91d9-de5a341f4205',
  '3a27f512-929b-4f0f-8112-73d745148ce1',
])
if (templates.error) throw templates.error
const hongdae = templates.data.find(row => row.id === '82535339-150c-46f9-91d9-de5a341f4205')
const busan = templates.data.find(row => row.id === '3a27f512-929b-4f0f-8112-73d745148ce1')
if (!hongdae || !busan) throw new Error('지점 템플릿을 찾지 못했습니다.')

const allDays = (open, close) => Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, { open, close }]))
const branches = [
  {
    suffix: '홍대점', template: hongdae, detail: '5F 애니메이트 카페 홍대점', hours: allDays('11:00', '22:00'), hoursInfo: '매일 11:00~22:00\n라스트오더 21:00',
    reserveStart: '2026-09-05', reserveEnd: '2026-09-06', entry: '사전예약 후 입장\n현장 추가 예약 및 자유 입장 전환 가능',
    tickets: [{ url: bookingUrl, label: '콜라보 카페 예약하기' }], sources: [source, workSource, 'https://x.com/animatecafe_kor'],
  },
  {
    suffix: '부산점', template: busan, detail: '11F 애니메이트 카페 부산점', hours: allDays('11:00', '22:00'), hoursInfo: '매일 11:00~22:00\n라스트오더 21:00',
    reserveStart: null, reserveEnd: null, entry: null, tickets: [], sources: [workSource, 'https://x.com/animatecafe_bs'],
  },
]

const results = []
for (const branch of branches) {
  const title = `전지적 독자 시점 × 애니메이트 카페 (${branch.suffix})`
  const { id: _templateId, ...place } = branch.template
  const payload = {
    tag_id: tag.data.id, type: 'collab_cafe', title,
    start_date: '2026-09-02', end_date: '2026-10-13', reserve_start: branch.reserveStart, reserve_end: branch.reserveEnd,
    entry_info: branch.entry,
    description: '웹툰 「전지적 독자 시점」의 캐릭터와 세계관을 테마로 진행되는 공식 콜라보 카페입니다.\n\n콜라보 메뉴와 한정 굿즈, 구매 금액별 카페 특전을 함께 만날 수 있습니다.',
    cover_url: coverUrl, ...place, place_detail: branch.detail,
    hours: branch.hours, hours_info: branch.hoursInfo,
    source_urls: branch.sources, ticket_urls: branch.tickets,
    updated_by: editor, updated_at: new Date().toISOString(),
  }
  const duplicate = await db.from('events').select('id').eq('title', title).eq('start_date', payload.start_date).maybeSingle()
  if (duplicate.error) throw duplicate.error
  const saved = duplicate.data
    ? await db.from('events').update(payload).eq('id', duplicate.data.id).select('*').single()
    : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
  if (saved.error) throw saved.error
  results.push({ status: duplicate.data ? 'UPDATED' : 'INSERTED', eventId: saved.data.id, title })
}

console.log(JSON.stringify({ results, pending: ['한국 공식 메뉴·굿즈·특전 원본 이미지', '부산점 입장·예약 방식'] }, null, 2))

