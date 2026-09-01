import {createClient} from '@supabase/supabase-js'
import {config} from 'dotenv'
import {mkdir,writeFile} from 'node:fs/promises'
config({path:'../.env.local'})
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor='e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title='제22회 서울인디애니페스트2026'

const old=await db.from('events').select('*').eq('title',title).maybeSingle()
if(old.error)throw old.error
await mkdir('scripts/event-backups',{recursive:true})
await writeFile(`scripts/event-backups/before-indie-anifest-${Date.now()}.json`,JSON.stringify(old.data,null,2))

const kakao=await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?query='+encodeURIComponent('CGV 연남'),{headers:{Authorization:`KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_KEY}`}})
if(!kakao.ok)throw new Error(`Kakao place search failed ${kakao.status}`)
const docs=(await kakao.json()).documents
const found=docs.find(x=>x.place_name.includes('CGV')&&x.place_name.includes('연남'))
if(!found)throw new Error('CGV 연남 place search result not found')

let place=(await db.from('places').select('*').eq('kakao_place_id',found.id).maybeSingle())
if(place.error)throw place.error
if(!place.data){
 const inserted=await db.from('places').insert({
  slug:'cgv-yeonnam',name:'CGV 연남',place_type:'CINEMA',addr:found.road_address_name||found.address_name,
  region:'서울',district:'마포구',lat:Number(found.y),lng:Number(found.x),kakao_place_id:found.id,
  category_name:found.category_name,parking:true,
  parking_note:'주차 가능(유료)\n당일 관람 티켓 인증 시 주중·주말 3시간 5,000원\n3시간 초과 시 15분당 1,500원\n차량 1대당 최대 3시간까지만 할인 적용'
 }).select('*').single()
 if(inserted.error)throw inserted.error
 place=inserted
}

let tag=(await db.from('tags').select('*').eq('slug','seoul-indie-anifest').maybeSingle())
if(tag.error)throw tag.error
if(!tag.data){
 const inserted=await db.from('tags').insert({name:'서울인디애니페스트',slug:'seoul-indie-anifest',ip_type:'애니메이션 영화제',genres:['애니메이션','독립영화'],description:'국내외 독립 애니메이션의 다양성과 가능성을 소개하는 애니메이션 영화제.',official_url:'https://www.ianifest.org/'}).select('*').single()
 if(inserted.error)throw inserted.error
 tag=inserted
}

const img=await fetch('https://www.ianifest.org/images/main/m_main_visual_slide01.jpg')
if(!img.ok)throw new Error(`poster download failed ${img.status}`)
const storagePath='covers/2026/seoul-indie-anifest-2026-main-poster.jpg'
const upload=await db.storage.from('event-goods').upload(storagePath,Buffer.from(await img.arrayBuffer()),{contentType:'image/jpeg',upsert:true})
if(upload.error)throw upload.error
const cover=db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const event={
 tag_id:tag.data.id,type:'exhibition',title,start_date:'2026-09-17',end_date:'2026-09-22',reserve_start:null,reserve_end:null,
 entry_info:'예매 후 입장\n현장 발권 가능',
 description:'국내외 독립 애니메이션의 다양한 작품을 극장에서 만나는 제22회 서울인디애니페스트입니다. 경쟁·초청 상영과 감독·게스트 토크가 함께 진행됩니다.\n\n모든 상영은 정시에 시작하며 상영 10분 전부터 입장할 수 있습니다. 시작 후 20분까지만 지연 입장이 가능하고, 연령 제한 작품은 신분증 확인이 진행될 수 있습니다.',
 cover_url:cover,place_id:place.data.id,place_name:place.data.name,place_addr:place.data.addr,place_lat:place.data.lat,place_lng:place.data.lng,
 place_detail:'7층 CGV연남',parking:true,parking_note:place.data.parking_note,hours:null,
 hours_info:'회차별 상영시간 상이\n상영 10분 전 입장 시작\n상영 시작 후 20분까지 지연 입장 가능',
 source_urls:['https://www.ianifest.org/','https://www.ianifest.org/sub/screening_schedule.asp','https://ianifest.org/sub/watch_notice.asp','https://cgv.co.kr/cnm/bzplcCgv/0292001'],
 ticket_urls:[{url:'https://www.cgv.co.kr/',label:'영화제 예매하기'}],updated_by:editor,updated_at:new Date().toISOString()
}
const result=old.data?await db.from('events').update(event).eq('id',old.data.id).select('*').single():await db.from('events').insert(event).select('*').single()
if(result.error)throw result.error
console.log(JSON.stringify({status:old.data?'UPDATE':'INSERT',id:result.data.id,title:result.data.title,place:place.data,cover_url:cover,ticket_urls:result.data.ticket_urls},null,2))
