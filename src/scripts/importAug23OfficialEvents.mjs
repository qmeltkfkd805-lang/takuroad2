import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const now = new Date().toISOString()
const daily = (open, close) => Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day,{open,close}]))

async function ensureTag(name, slug) {
  let r = await db.from('tags').select('*').eq('slug', slug).maybeSingle()
  if (r.error) throw r.error
  if (!r.data) r = await db.from('tags').select('*').eq('name', name).maybeSingle()
  if (r.error) throw r.error
  if (!r.data) r = await db.from('tags').insert({name,slug}).select('*').single()
  if (r.error) throw r.error
  return r.data
}

async function ensurePlace(row) {
  let r = await db.from('places').select('*').eq('kakao_place_id', row.kakao_place_id).maybeSingle()
  if (r.error) throw r.error
  if (!r.data) r = await db.from('places').insert(row).select('*').single()
  if (r.error) throw r.error
  return r.data
}

async function existingPlace(kakaoId) {
  const r = await db.from('places').select('*').eq('kakao_place_id', kakaoId).single()
  if (r.error) throw r.error
  return r.data
}

const tags = Object.fromEntries(await Promise.all([
  ['conan','명탐정 코난','detective-conan'],['ourguild','우리길드 아이돌','our-guild-idol'],['arknights','명일방주','arknights'],
  ['genshin','원신','genshin-impact'],['dungeon','던전밥','delicious-in-dungeon'],['haikyuu','하이큐!!','haikyuu'],
  ['ito','이토 준지','junji-ito'],['apothecary','약사의 혼잣말','the-apothecary-diaries'],['reborn','가정교사 히트맨 리본','katekyo-hitman-reborn'],
  ['banpresto','반프레스토','banpresto'],['rent','여친, 빌리겠습니다','rent-a-girlfriend'],['demon','귀멸의 칼날','demon-slayer'],
].map(async ([key,name,slug]) => [key, await ensureTag(name,slug)])))

const [hyundai,ipark,ak,jamsil] = await Promise.all(['1662602781','7990380','1156421273','1680392963'].map(existingPlace))
const places = {
  anipop: await ensurePlace({slug:'anipop-goods-shop-daechi',name:'애니팝 굿즈샵',place_type:'CULTURE_SPACE',addr:'서울 강남구 영동대로85길 13',region:'서울',district:'강남구',lat:37.50692635032554,lng:127.0625997539978,kakao_place_id:'1780948299',category_name:'가정,생활 > 취미 > 취미용품점',parking:null,parking_note:null}),
  samjung: await ensurePlace({slug:'samjung-tower',name:'삼정타워',place_type:'SHOPPING_MALL',addr:'부산 부산진구 중앙대로 672',region:'부산',district:'부산진구',lat:35.1530135123952,lng:129.059606833427,kakao_place_id:'974194707',category_name:'가정,생활 > 복합쇼핑몰',parking:null,parking_note:null}),
  sfactory: await ensurePlace({slug:'s-factory-seongsu',name:'에스팩토리',place_type:'EXHIBITION',addr:'서울 성동구 연무장15길 11',region:'서울',district:'성동구',lat:37.5426445439481,lng:127.059573316959,kakao_place_id:'1891570540',category_name:'문화,예술 > 문화시설',parking:false,parking_note:'주차 불가\n인근 공영주차장을 이용해 주세요.'}),
  niceghost: await ensurePlace({slug:'nice-ghost-club-seongsu-flagship',name:'나이스고스트클럽 성수플래그십스토어',place_type:'CULTURE_SPACE',addr:'서울 성동구 성수이로7길 38',region:'서울',district:'성동구',lat:37.5425006030077,lng:127.053468556449,kakao_place_id:'587520785',category_name:'가정,생활 > 패션 > 의류판매',parking:null,parking_note:null}),
  musinsaMyeongdong: await ensurePlace({slug:'musinsa-store-myeongdong',name:'무신사 스토어 명동점',place_type:'SHOPPING_MALL',addr:'서울 중구 명동길 13',region:'서울',district:'중구',lat:37.563832703829,lng:126.983022093658,kakao_place_id:'976987247',category_name:'가정,생활 > 패션 > 의류판매 > 무신사 스토어',parking:null,parking_note:null}),
  toonique: await ensurePlace({slug:'toonique-universe',name:'투니크 유니버스점',place_type:'CULTURE_SPACE',addr:'서울 마포구 양화로 78-17',region:'서울',district:'마포구',lat:37.5512940984154,lng:126.917849761575,kakao_place_id:'355451977',category_name:'음식점 > 카페',parking:null,parking_note:null}),
  bemill: await ensurePlace({slug:'stage-bemill',name:'스테이지 비밀',place_type:'EXHIBITION',addr:'서울 마포구 동교로 161',region:'서울',district:'마포구',lat:37.55596434401477,lng:126.91970408566432,kakao_place_id:'1397107159',category_name:'문화,예술 > 문화시설 > 전시관',parking:false,parking_note:'주차 불가\n인근 공영주차장을 이용해 주세요.'}),
}

const p = (place, detail) => ({place_id:place.id,place_name:place.name,place_addr:place.addr,place_lat:place.lat,place_lng:place.lng,place_detail:detail,parking:place.parking,parking_note:place.parking_note})
const base = {reserve_start:null,reserve_end:null,ticket_urls:[],updated_at:now}
const events = [
  {...base,tag_id:tags.conan.id,type:'popup',title:'명탐정 코난 WIND FESTIVAL 팝업스토어',start_date:'2026-08-20',end_date:'2026-08-26',entry_info:'현장 선착순 입장',description:'명탐정 코난의 여름 테마 상품과 극장판 「하이웨이의 타천사」 상품을 만나는 팝업스토어입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-13/1e63c07b-0557-4901-a535-45dea1fbf708.webp',...p(hyundai,'지하 2층 ICONIC'),hours:daily('10:30','20:10'),hours_info:'매일 10:30~20:10',source_urls:['https://x.com/i/status/2085252246011252940']},
  {...base,tag_id:tags.ourguild.id,type:'popup',title:'우리길드 아이돌 팝업스토어',start_date:'2026-08-01',end_date:'2026-08-28',entry_info:'현장 선착순 입장',description:'「우리길드 아이돌」 신규 공식 상품을 선보이는 팝업스토어입니다.\n\n7만원 이상 구매 시 한정 특전을 랜덤 증정하며, 준비 수량 소진 시 종료됩니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-19/833fe725-7c05-425f-8d34-cfc7d6b949a0.jpg',...p(ipark,'리빙파크 3층 도파민스테이션'),hours:daily('10:30','22:00'),hours_info:'매일 10:30~22:00',source_urls:['https://www.instagram.com/p/DakTALmmC-e/']},
  {...base,tag_id:tags.arknights.id,type:'popup',title:'명일방주 앰비언스 시네스티시아 팝업스토어',start_date:'2026-08-16',end_date:'2026-08-30',entry_info:'현장 선착순 입장',description:'「명일방주」 앰비언스 시네스티시아 테마의 공식 상품을 만나는 팝업스토어입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-21/c7638c96-df7d-4338-a07b-046840851513.jpg',...p(places.anipop,'5층 애니팝 굿즈샵'),hours:daily('11:00','21:00'),hours_info:'매일 11:00~21:00',source_urls:['https://x.com/GLStore_KR/status/2082713951998259568']},
  {...base,tag_id:tags.genshin.id,type:'popup',title:'원신 한여름 파티 팝업 스토어',start_date:'2026-08-21',end_date:'2026-08-30',entry_info:'현장 선착순 입장',description:'「원신」 한여름 파티 테마의 공식 상품과 콘텐츠를 만나는 부산 팝업스토어입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-19/df2afe54-2011-4ea9-a59b-fdfb91e26d82.jpg',...p(places.samjung,'7층'),hours:{mon:{open:'11:00',close:'22:00'},tue:{open:'11:00',close:'22:00'},wed:{open:'11:00',close:'22:00'},thu:{open:'11:00',close:'22:00'},fri:{open:'11:00',close:'22:30'},sat:{open:'11:00',close:'22:30'},sun:{open:'11:00',close:'22:00'}},hours_info:'일~목 11:00~22:00\n금·토 11:00~22:30',source_urls:['https://www.instagram.com/p/Db2pH93sLDe/']},
  {...base,tag_id:tags.dungeon.id,type:'exhibition',title:'쿠이료코전 & 「던전밥」 미궁탐색전',start_date:'2026-06-20',end_date:'2026-08-30',entry_info:'예매 후 입장\n현장 구매 가능',description:'쿠이 료코의 작품 세계와 애니메이션 「던전밥」의 미궁을 함께 만나는 전시입니다. 입장 마감은 19:00입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-06-16/435d348a-e833-4d87-b742-6118ccadba4d.jpg',...p(places.sfactory,'D동 3층'),hours:daily('11:00','20:00'),hours_info:'매일 11:00~20:00\n입장 마감 19:00',source_urls:['https://x.com/CrumBloom/status/2059847694911193179'],ticket_urls:[{url:'https://tickets.interpark.com/goods/26007877',label:'전시 예매하기'}]},
  {...base,tag_id:tags.haikyuu.id,type:'collab_cafe',title:'하이큐!! × 애니메이트 콜라보 카페',start_date:'2026-08-05',end_date:'2026-08-30',entry_info:'현장 선착순 입장',description:'「하이큐!!」 테마 메뉴와 공식 상품을 만나는 애니메이트 콜라보 카페입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-07-30/743a5f0a-2ecd-40a2-96d8-ef79f500a60e.jpg',...p(ak,'5층 애니메이트 카페 홍대점'),hours:daily('11:00','22:00'),hours_info:'매일 11:00~22:00',source_urls:['https://x.com/animatecafe_kor/status/2080579868102930766']},
  {...base,tag_id:tags.ito.id,type:'popup',title:'이토 준지 × 산리오 캐릭터즈 × 나이스고스트클럽 팝업 (성수)',start_date:'2026-08-18',end_date:'2026-09-17',entry_info:'현장 선착순 입장',description:'이토 준지와 산리오 캐릭터즈, 나이스고스트클럽의 협업 상품을 선보이는 팝업입니다. 7만원 이상 구매 특전은 준비 수량 소진 시 종료됩니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-19/fdc2f697-bd14-400c-821b-3ff5516d5f71.png',...p(places.niceghost,'성수 플래그십스토어'),hours:daily('11:00','20:00'),hours_info:'매일 11:00~20:00',source_urls:['https://www.instagram.com/p/Dbpol_NvhE5/']},
  {...base,tag_id:tags.ito.id,type:'popup',title:'이토 준지 × 산리오 캐릭터즈 × 나이스고스트클럽 팝업 (명동)',start_date:'2026-08-18',end_date:'2026-08-31',entry_info:'현장 선착순 입장',description:'이토 준지와 산리오 캐릭터즈, 나이스고스트클럽의 협업 상품을 선보이는 팝업입니다. 7만원 이상 구매 특전은 준비 수량 소진 시 종료됩니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-19/fdc2f697-bd14-400c-821b-3ff5516d5f71.png',...p(places.musinsaMyeongdong,'무신사 스토어 명동점'),hours:daily('11:00','23:00'),hours_info:'매일 11:00~23:00',source_urls:['https://www.instagram.com/p/Dbpol_NvhE5/']},
  {...base,tag_id:tags.apothecary.id,type:'collab_cafe',title:'약사의 혼잣말 × 애니메이트 콜라보 카페 (홍대점)',start_date:'2026-08-22',end_date:'2026-09-06',entry_info:'현장 선착순 입장',description:'「약사의 혼잣말」 만우절 페어 일러스트를 활용한 Gratte 메뉴와 특전을 만나는 콜라보 카페입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-07-15/dbaab4f4-c319-4681-a8ec-e7b2e62601db.jpg',...p(ak,'5층 애니메이트 카페 홍대점'),hours:daily('11:00','22:00'),hours_info:'매일 11:00~22:00',source_urls:['https://x.com/animatecafe_js/status/2075493439626747982']},
  {...base,tag_id:tags.apothecary.id,type:'collab_cafe',title:'약사의 혼잣말 × 애니메이트 콜라보 카페 (잠실점)',start_date:'2026-08-22',end_date:'2026-09-06',entry_info:'현장 선착순 입장',description:'「약사의 혼잣말」 만우절 페어 일러스트를 활용한 Gratte 메뉴와 특전을 만나는 콜라보 카페입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-07-15/dbaab4f4-c319-4681-a8ec-e7b2e62601db.jpg',...p(jamsil,'애니메이트 카페 잠실롯데점'),hours:daily('10:00','21:00'),hours_info:'매일 10:00~21:00',source_urls:['https://x.com/animatecafe_js/status/2075493439626747982']},
  {...base,tag_id:tags.reborn.id,type:'collab_cafe',title:'가정교사 히트맨 리본! Gratte (홍대점)',start_date:'2026-08-22',end_date:'2026-09-06',entry_info:'현장 선착순 입장',description:'「가정교사 히트맨 리본!」 일러스트를 활용한 Gratte 메뉴와 특전을 만나는 행사입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-12/7777dd81-5274-4297-812b-24b200731668.jpg',...p(ak,'5층 애니메이트 홍대점'),hours:daily('11:00','21:40'),hours_info:'매일 11:00~21:40',source_urls:['https://x.com/animate_hongdae/status/2072893096359301366']},
  {...base,tag_id:tags.reborn.id,type:'collab_cafe',title:'가정교사 히트맨 리본! Gratte (잠실점)',start_date:'2026-08-22',end_date:'2026-09-06',entry_info:'현장 선착순 입장',description:'「가정교사 히트맨 리본!」 일러스트를 활용한 Gratte 메뉴와 특전을 만나는 행사입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-12/5dcb7de5-3463-4536-9c83-a0273edbbd07.jpg',...p(jamsil,'애니메이트 카페 잠실롯데점'),hours:daily('10:00','21:00'),hours_info:'매일 10:00~21:00',source_urls:['https://x.com/animate_hongdae/status/2072893096359301366']},
  {...base,tag_id:tags.rent.id,type:'collab_cafe',title:'투니크 × 여친, 빌리겠습니다 콜라보 카페',start_date:'2026-08-20',end_date:'2026-09-13',entry_info:'현장 선착순 입장',description:'「여친, 빌리겠습니다」 테마 메뉴와 공식 상품을 만나는 투니크 콜라보 카페입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-19/e9aabb7c-ab40-4bc4-a2bc-6612f1a11f41.jpg',...p(places.toonique,'카페 투니크 유니버스점'),hours:daily('11:00','21:00'),hours_info:'매일 11:00~21:00',source_urls:['https://x.com/Toonique_02/status/2087464109155754007']},
  {...base,tag_id:tags.demon.id,type:'exhibition',title:'귀멸의 칼날 : 전집중展',start_date:'2026-06-27',end_date:'2026-09-27',reserve_start:'2026-06-01',reserve_end:'2026-09-27',entry_info:'예매 후 입장\n현장 구매 가능',description:'「귀멸의 칼날」 주요 장면과 공간을 재현한 몰입형 전시입니다. 입장 마감은 20:00이며, 8월 15일은 휴관입니다. 입장 후 재입장과 환불은 불가합니다.',cover_url:'https://media.orings.co.kr/static/place/2026-05-26/9c8c5403-83a9-421d-b2fd-50972147b2b8.jpg',...p(places.sfactory,'D동 1층'),hours:daily('11:00','21:00'),hours_info:'매일 11:00~21:00\n입장 마감 20:00\n8월 15일 휴관',source_urls:['https://www.instagram.com/kimetsu_ex_kr/'],ticket_urls:[{url:'https://feverup.com/m/653974',label:'전시 예매하기'}]},
  {...base,tag_id:tags.apothecary.id,type:'exhibition',title:'약사의 혼잣말 특별전',start_date:'2026-07-04',end_date:'2026-09-30',reserve_start:null,reserve_end:'2026-09-30',entry_info:'예매 후 입장\n현장 발권 가능',description:'「약사의 혼잣말」의 주요 장면과 캐릭터 서사를 공간으로 체험하는 특별전입니다. 예매 고객 대상 포토카드는 준비 수량 소진 시 종료됩니다. 재입장은 불가합니다.',cover_url:'https://media.orings.co.kr/static/place/2026-06-24/b1f37546-bc18-4049-ae0d-13c3570eb1d2.jpg',...p(places.bemill,'2층'),hours:daily('11:00','20:00'),hours_info:'매일 11:00~20:00',source_urls:['https://x.com/stage_bemill/status/2065267998970249307'],ticket_urls:[{url:'https://be-mill.com/products/view/WPKTOO9OTI',label:'전시 예매하기'}]},
]

const results=[]
for (const event of events) {
  const found=await db.from('events').select('id').eq('title',event.title).eq('start_date',event.start_date).maybeSingle()
  if (found.error) throw found.error
  const q=found.data ? db.from('events').update(event).eq('id',found.data.id) : db.from('events').insert(event)
  const r=await q.select('id,title,start_date,end_date,place_name,place_detail,hours_info,entry_info,cover_url,source_urls,ticket_urls').single()
  if(r.error) throw r.error
  results.push({status:found.data?'UPDATE':'INSERT',...r.data})
}
console.log(JSON.stringify(results,null,2))
