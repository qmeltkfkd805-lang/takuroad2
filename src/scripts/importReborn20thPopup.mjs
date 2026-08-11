import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

let { data: tag, error: tagLookupError } = await db
  .from('tags')
  .select('id,slug')
  .in('slug', ['katekyo-hitman-reborn', 'reborn'])
  .limit(1)
  .maybeSingle()

if (tagLookupError) throw tagLookupError

if (!tag) {
  const created = await db.from('tags').insert({
    name: '가정교사 히트맨 REBORN!',
    slug: 'katekyo-hitman-reborn',
    english_name: 'Katekyo Hitman REBORN!',
    ip_type: '만화,애니',
    genres: ['액션', '코미디', '소년만화'],
    aliases: ['가히리', '가정교사 히트맨 리본', '家庭教師ヒットマンREBORN!'],
  }).select('id,slug').single()

  if (created.error) throw created.error
  tag = created.data
}

const placeResult = await db
  .from('places')
  .select('id,name,addr,lat,lng,parking,parking_note')
  .eq('kakao_place_id', '1156421273')
  .single()

if (placeResult.error) throw placeResult.error
const place = placeResult.data

const title = '가정교사 히트맨 리본! 20주년 기념 POP UP STORE'
const duplicate = await db.from('events').select('id,title').eq('title', title).maybeSingle()
if (duplicate.error) throw duplicate.error

if (duplicate.data) {
  console.log(JSON.stringify({ status: 'SKIP', ...duplicate.data }))
  process.exit(0)
}

const result = await db.from('events').insert({
  tag_id: tag.id,
  type: 'popup',
  title,
  start_date: '2026-08-17',
  end_date: '2026-09-01',
  place_id: place.id,
  place_name: place.name,
  place_addr: place.addr,
  place_lat: place.lat,
  place_lng: place.lng,
  place_detail: '1층',
  parking: place.parking,
  parking_note: place.parking_note,
  hours: {
    mon: { open: '11:00', close: '22:00' },
    tue: { open: '11:00', close: '22:00' },
    wed: { open: '11:00', close: '22:00' },
    thu: { open: '11:00', close: '22:00' },
    fri: { open: '11:00', close: '22:00' },
    sat: { open: '10:30', close: '22:00' },
    sun: { open: '10:30', close: '22:00' },
  },
  hours_info: '평일 11:00~22:00\n주말·공휴일 10:30~22:00',
  entry_info: '입장 안내 미공개',
  description: 'TV 애니메이션 20주년 기념 비주얼과 한국 오리지널 상품을 선보이는 팝업스토어입니다.',
  cover_url: 'https://pbs.twimg.com/media/HNvOC9NbYAAJfJy.jpg?name=orig',
  source_urls: ['https://x.com/smc_somaco/status/2079793561240002737'],
  ticket_urls: [],
  updated_at: new Date().toISOString(),
}).select('id,title,start_date,end_date,place_name,place_detail,hours_info,entry_info,parking,parking_note,cover_url,source_urls,ticket_urls').single()

if (result.error) throw result.error
console.log(JSON.stringify({ status: 'INSERT', ...result.data }))
