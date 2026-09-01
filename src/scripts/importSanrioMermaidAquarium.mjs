import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const title='Sanrio characters in 롯데월드 아쿠아리움 : 머메이드 파티'
const editor='e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const officialPost='https://lotteworldrecruit.tistory.com/entry/%EC%82%B0%EB%A6%AC%EC%98%A4%EC%BA%90%EB%A6%AD%ED%84%B0%EC%A6%88%EA%B0%80-%EC%B4%88%EB%8C%80%ED%95%98%EB%8A%94-%EB%B0%94%EB%8B%B7%EC%86%8D-%EB%A8%B8%EB%A9%94%EC%9D%B4%EB%93%9C-%ED%8C%8C%ED%8B%B0-%EB%A1%AF%EB%8D%B0%EC%9B%94%EB%93%9C-%EC%95%84%EC%BF%A0%EC%95%84%EB%A6%AC%EC%9B%80-%EC%82%B0%EB%A6%AC%EC%98%A4%EC%BA%90%EB%A6%AD%ED%84%B0%EC%A6%88%EC%99%80-%EA%B0%80%EC%9D%84-%EC%8B%9C%EC%A6%8C-%EC%B6%95%EC%A0%9C-%EC%98%A4%ED%94%88'
const imageUrl='https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fblog.kakaocdn.net%2Fdna%2F9OewJ%2FdJMcabecK9i%2FAAAAAAAAAAAAAAAAAAAAAOsDMmKJA1qt4-x2D7h4WBciWmF-smtLrQFnB6VUkOKm%2Fimg.jpg%3Fcredential%3DyqXZFxpELC7KVnFOS48ylbz2pIh7yKj8%26expires%3D1788188399%26allow_ip%3D%26allow_referer%3D%26signature%3DlcbR5f0IIGh30g346h2RfVBDVzM%253D'

const old=await db.from('events').select('*').eq('title',title).maybeSingle()
if(old.error)throw old.error
await mkdir('scripts/event-backups',{recursive:true})
await writeFile(`scripts/event-backups/before-sanrio-mermaid-${Date.now()}.json`,JSON.stringify(old.data,null,2))

const image=await fetch(imageUrl)
if(!image.ok)throw new Error(`image download failed ${image.status}`)
const path='covers/2026/sanrio-mermaid-aquarium.jpg'
const upload=await db.storage.from('event-goods').upload(path,Buffer.from(await image.arrayBuffer()),{contentType:'image/jpeg',upsert:true})
if(upload.error)throw upload.error
const cover=db.storage.from('event-goods').getPublicUrl(path).data.publicUrl

const hours={
 mon:{open:'10:00',close:'20:00'},tue:{open:'10:00',close:'20:00'},wed:{open:'10:00',close:'20:00'},thu:{open:'10:00',close:'20:00'},
 fri:{open:'10:00',close:'22:00'},sat:{open:'10:00',close:'22:00'},sun:{open:'10:00',close:'22:00'}
}
const event={
 tag_id:'f6dff3d1-5a30-409d-849c-9a34d111b1be',type:'exhibition',title,
 start_date:'2026-09-04',end_date:'2026-11-29',reserve_start:null,reserve_end:null,
 entry_info:'입장권 구매 후 입장\n현장 발권 가능',
 description:'인어로 변신한 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 한교동과 함께 즐기는 롯데월드 아쿠아리움 공식 시즌 축제입니다.\n\n유료 AR 미션을 완료하면 산리오캐릭터즈 랜덤 ID카드 키링을 받을 수 있습니다. 매주 토요일에는 지하 2층 메인수조 앞에서 마이멜로디 포토타임이 11:30, 14:00, 16:00에 진행됩니다.\n\n컬래버 굿즈와 포토 상품, 한정 식음 메뉴는 준비 수량에 따라 조기 품절될 수 있습니다.',
 cover_url:cover,place_id:'037ee556-bbf3-42f0-ae4a-b126d859d1c1',place_name:'롯데월드타워&롯데월드몰',
 place_addr:'서울 송파구 올림픽로 300',place_lat:37.5136519138098,place_lng:127.104079482694,place_detail:'롯데월드 아쿠아리움 B1F·B2F',
 parking:true,parking_note:'주차 가능(유료)\n10:00~20:00 10분당 500원\n그 외 시간 10분당 200원\n아쿠아리움 이용 시 최대 4시간 주차 할인 적용',
 hours,hours_info:'월~목 10:00~20:00\n금~일 10:00~22:00\n입장 및 매표 마감 운영 종료 1시간 전',
 source_urls:[officialPost,'https://aquarium.lotteworld.com/','https://aquarium.lotteworld.com/usage-guide/service/operation-information/list'],
 ticket_urls:[{url:'https://aquarium.lotteworld.com/price/ticket/price',label:'아쿠아리움 예매하기'}],updated_by:editor,updated_at:new Date().toISOString()
}
const result=old.data?await db.from('events').update(event).eq('id',old.data.id).select('*').single():await db.from('events').insert(event).select('*').single()
if(result.error)throw result.error
console.log(JSON.stringify({status:old.data?'UPDATE':'INSERT',id:result.data.id,title:result.data.title,cover_url:result.data.cover_url,hours_info:result.data.hours_info,ticket_urls:result.data.ticket_urls},null,2))
