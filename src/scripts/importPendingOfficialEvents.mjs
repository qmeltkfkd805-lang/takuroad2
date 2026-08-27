import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const now = new Date().toISOString()
const daily = (open, close) => Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day, { open, close }]))

async function ensurePlace(row) {
  let result = await db.from('places').select('*').eq('kakao_place_id', row.kakao_place_id).maybeSingle()
  if (result.error) throw result.error
  if (!result.data) {
    result = await db.from('places').insert(row).select('*').single()
    if (result.error) throw result.error
  }
  return result.data
}
async function ensureTag(name, slug) {
  let result = await db.from('tags').select('*').eq('slug', slug).maybeSingle()
  if (result.error) throw result.error
  if (!result.data) {
    result = await db.from('tags').select('*').eq('name', name).maybeSingle()
    if (result.error) throw result.error
  }
  if (!result.data) {
    result = await db.from('tags').insert({ name, slug }).select('*').single()
    if (result.error) throw result.error
  }
  return result.data
}

const { data: ak, error: akError } = await db.from('places').select('*').eq('kakao_place_id', '1156421273').single()
if (akError) throw akError
const { data: uplex, error: uplexError } = await db.from('places').select('*').eq('kakao_place_id', '26992232').single()
if (uplexError) throw uplexError
const jamsil = await ensurePlace({
  slug: 'animate-jamsil-lotte', name: '애니메이트 잠실롯데점', place_type: 'SHOPPING_MALL',
  addr: '서울 송파구 올림픽로 240', region: '서울', district: '송파구', lat: 37.5116711641753, lng: 127.09816575087,
  kakao_place_id: '1680392963', category_name: '가정,생활 > 취미 > 취미용품점', parking: true,
  parking_note: '주차 가능(유료)\n최초 30분 1,000원, 이후 10분당 1,000원\n5만원 이상 구매 시 1시간, 10만원 이상 2시간, 15만원 이상 3시간 무료\n무료 주차는 최대 3시간',
})
const vsquare = await ensurePlace({
  slug: 'vsquare-konkuk', name: '브이스퀘어', place_type: 'CULTURE_SPACE',
  addr: '서울 광진구 아차산로 272', region: '서울', district: '광진구', lat: 37.5385663338369, lng: 127.072929435508,
  kakao_place_id: '866035092', category_name: '문화,예술 > 문화시설 > 전시관', parking: null, parking_note: null,
})
const projectSekai = { id: 'f2658c7d-a3d0-4343-9b21-d0cab3d59ab8' }
const amnesia = await ensureTag('AMNESIA', 'amnesia')
const seeu = await ensureTag('SeeU', 'seeu')
const priconne = await ensureTag('프린세스 커넥트! Re:Dive', 'princess-connect-redive')

const base = { reserve_start: null, reserve_end: null, entry_info: '현장 선착순 입장', ticket_urls: [], updated_at: now }
const events = [
  { ...base, tag_id: projectSekai.id, type: 'collab_cafe', title: '프로젝트 세카이 컬러풀 스테이지! feat. 하츠네 미쿠 해외 한정 Gratte (홍대점)', start_date:'2026-08-15', end_date:'2026-08-30', description:'프로젝트 세카이 해외 한정 일러스트를 활용한 Gratte 행사입니다. 캐릭터 그라떼와 쿠키, 유상 특전을 만날 수 있습니다.', cover_url:'https://media.orings.co.kr/static/place/2026-08-06/c9d2de82-8172-47d7-b65b-10499183398c.jpg', place_id:ak.id, place_name:ak.name, place_addr:ak.addr, place_lat:ak.lat, place_lng:ak.lng, place_detail:'5층 애니메이트 홍대점', parking:ak.parking, parking_note:ak.parking_note, hours:daily('11:00','21:40'), hours_info:'매일 11:00~21:40', source_urls:['https://x.com/animate_hongdae/status/2080488138162557358'] },
  { ...base, tag_id: projectSekai.id, type: 'collab_cafe', title: '프로젝트 세카이 컬러풀 스테이지! feat. 하츠네 미쿠 해외 한정 Gratte (잠실점)', start_date:'2026-08-15', end_date:'2026-08-30', description:'프로젝트 세카이 해외 한정 일러스트를 활용한 Gratte 행사입니다. 캐릭터 그라떼와 쿠키, 유상 특전을 만날 수 있습니다.', cover_url:'https://media.orings.co.kr/static/place/2026-08-06/165d8917-1c88-44b0-9b50-3309009a585f.jpg', place_id:jamsil.id, place_name:jamsil.name, place_addr:jamsil.addr, place_lat:jamsil.lat, place_lng:jamsil.lng, place_detail:'애니메이트 카페 잠실롯데점', parking:jamsil.parking, parking_note:jamsil.parking_note, hours:daily('10:00','21:00'), hours_info:'매일 10:00~21:00', source_urls:['https://x.com/animatecafe_js/status/2080488151806509412'] },
  { ...base, tag_id: amnesia.id, type: 'collab_cafe', title: 'AMNESIA WORLD Gratte (홍대점)', start_date:'2026-08-08', end_date:'2026-09-06', description:'AMNESIA WORLD 일러스트를 활용한 Gratte 행사입니다. 캐릭터 그라떼와 쿠키, 아이스크림 및 메뉴 결제 특전을 만날 수 있습니다.', cover_url:'https://media.orings.co.kr/static/place/2026-08-06/3c3b2fba-34f4-44d5-9823-9a65af6e698a.jpg', place_id:ak.id, place_name:ak.name, place_addr:ak.addr, place_lat:ak.lat, place_lng:ak.lng, place_detail:'5층 애니메이트 카페 홍대점', parking:ak.parking, parking_note:ak.parking_note, hours:daily('09:00','22:00'), hours_info:'매일 09:00~22:00', source_urls:['https://x.com/animatecafe_kor/status/2080563636662378968'] },
  { ...base, tag_id: amnesia.id, type: 'collab_cafe', title: 'AMNESIA WORLD Gratte (잠실점)', start_date:'2026-08-08', end_date:'2026-09-06', description:'AMNESIA WORLD 일러스트를 활용한 Gratte 행사입니다. 캐릭터 그라떼와 쿠키, 아이스크림 및 메뉴 결제 특전을 만날 수 있습니다.', cover_url:'https://media.orings.co.kr/static/place/2026-08-06/b32680b3-10ac-4e1f-bb91-e771bdf25218.jpg', place_id:jamsil.id, place_name:jamsil.name, place_addr:jamsil.addr, place_lat:jamsil.lat, place_lng:jamsil.lng, place_detail:'애니메이트 카페 잠실롯데점', parking:jamsil.parking, parking_note:jamsil.parking_note, hours:daily('10:00','21:00'), hours_info:'매일 10:00~21:00', source_urls:['https://x.com/animatecafe_js/status/2080563636762759562'] },
  { ...base, tag_id: seeu.id, type: 'collab_cafe', title: 'SeeU × 일러스타 카페', start_date:'2026-08-14', end_date:'2026-08-30', description:'버추얼 싱어 SeeU를 테마로 한 공식 콜라보 카페입니다. 캐릭터 메뉴와 행사 상품을 만날 수 있습니다.', cover_url:'https://media.orings.co.kr/static/place/2026-08-06/a2d45d31-3797-418e-ad88-8224acdab6fc.jpg', place_id:uplex.id, place_name:uplex.name, place_addr:uplex.addr, place_lat:uplex.lat, place_lng:uplex.lng, place_detail:'12층 일러스타 카페 신촌점', parking:uplex.parking, parking_note:uplex.parking_note, hours:daily('10:30','22:00'), hours_info:'매일 10:30~22:00', source_urls:['https://x.com/illustar_cafe/status/2081937782948368701'] },
  { ...base, tag_id: priconne.id, type: 'popup', title:'프린세스 커넥트! Re:Dive × 브이스퀘어 콜라보 팝업스토어', start_date:'2026-08-14', end_date:'2026-08-30', description:'프린세스 커넥트! Re:Dive의 한정 상품과 콜라보 카페, 포토존을 함께 선보이는 팝업스토어입니다.', cover_url:'https://media.orings.co.kr/static/place/2026-07-30/716543b1-2522-45fa-8a2b-fcdd2e65fc1a.png', place_id:vsquare.id, place_name:vsquare.name, place_addr:vsquare.addr, place_lat:vsquare.lat, place_lng:vsquare.lng, place_detail:'스타시티몰 롯데시네마 건대입구 3층', parking:vsquare.parking, parking_note:vsquare.parking_note, hours:daily('11:00','20:00'), hours_info:'매일 11:00~20:00', source_urls:['https://cafe.daum.net/priconne/miqO/1167'] },
]

const results = []
for (const event of events) {
  const existing = await db.from('events').select('id').eq('title', event.title).eq('start_date', event.start_date).maybeSingle()
  if (existing.error) throw existing.error
  const result = existing.data ? await db.from('events').update(event).eq('id', existing.data.id).select('id,title,place_name,hours_info,cover_url').single() : await db.from('events').insert(event).select('id,title,place_name,hours_info,cover_url').single()
  if (result.error) throw result.error
  results.push({ status: existing.data ? 'UPDATE' : 'INSERT', ...result.data })
}
console.log(JSON.stringify(results, null, 2))
