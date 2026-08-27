import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let tag = await db.from('tags').select('*').eq('slug','dragon-ball').maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) tag = await db.from('tags').select('*').ilike('name','드래곤볼').maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) tag = await db.from('tags').insert({name:'드래곤볼',slug:'dragon-ball'}).select('*').single()
if (tag.error) throw tag.error

const key = process.env.NEXT_PUBLIC_KAKAO_REST_KEY
const kakao = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('스테이지엑스 성수403')}`,{headers:{Authorization:`KakaoAK ${key}`}}).then(r=>r.json())
const hit = kakao.documents?.find(x => x.road_address_name === '서울 성동구 뚝섬로 403') ?? kakao.documents?.[0]
if (!hit) throw new Error('카카오 장소 검색 결과 없음')
let place = await db.from('places').select('*').eq('kakao_place_id',hit.id).maybeSingle()
if (place.error) throw place.error
if (!place.data) place = await db.from('places').insert({slug:'stage-x-seongsu-403',name:hit.place_name,place_type:'EXHIBITION',addr:hit.road_address_name || hit.address_name,region:'서울',district:'성동구',lat:Number(hit.y),lng:Number(hit.x),kakao_place_id:hit.id,category_name:hit.category_name,parking:false,parking_note:'주차 불가\n인근 공영주차장을 이용해 주세요.'}).select('*').single()
if (place.error) throw place.error

const event = {
  tag_id:tag.data.id,type:'exhibition',title:'드래곤볼 히어로즈 라이즈 아시아 투어 인 서울',
  start_date:'2026-08-22',end_date:'2026-11-15',reserve_start:'2026-08-03',reserve_end:null,
  entry_info:'예매 후 입장',
  description:'「드래곤볼」의 명장면과 캐릭터를 실감 미디어, 인터랙티브 게임, 실물 크기 스태츄로 만나는 체험형 전시입니다.\n\n얼리버드 판매는 종료됐지만 일반 티켓 예매는 가능합니다. 재입장은 불가합니다.',
  cover_url:'https://media.orings.co.kr/static/place/2026-08-24/45ed688f-4401-4e38-b7f0-54507105b369.jpg',
  place_id:place.data.id,place_name:place.data.name,place_addr:place.data.addr,place_lat:place.data.lat,place_lng:place.data.lng,place_detail:null,
  parking:false,parking_note:'주차 불가\n인근 공영주차장을 이용해 주세요.',
  hours:Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(d=>[d,{open:'11:00',close:'21:00'}])),hours_info:'매일 11:00~21:00',
  source_urls:['https://www.instagram.com/db_heroes_kr/'],
  ticket_urls:[{url:'https://be-mill.com/products/view/0QCAEPMDAE',label:'전시 예매하기'}],updated_at:new Date().toISOString(),
}
const old = await db.from('events').select('id').eq('title',event.title).eq('start_date',event.start_date).maybeSingle()
if (old.error) throw old.error
const result = old.data ? await db.from('events').update(event).eq('id',old.data.id).select('*').single() : await db.from('events').insert(event).select('*').single()
if (result.error) throw result.error
console.log(JSON.stringify({status:old.data?'UPDATE':'INSERT',id:result.data.id,title:result.data.title,place_name:result.data.place_name,reserve_start:result.data.reserve_start,reserve_end:result.data.reserve_end,ticket_urls:result.data.ticket_urls},null,2))
