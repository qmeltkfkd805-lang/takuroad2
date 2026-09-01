import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor='e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title='블리치 천년혈전편 × 피규어프레소 공식 콜라보 카페'
const oldEvents=await db.from('events').select('*').ilike('title','%블리치%'); if(oldEvents.error)throw oldEvents.error
const oldPlaces=await db.from('places').select('*').eq('kakao_place_id','2128926655'); if(oldPlaces.error)throw oldPlaces.error
await mkdir('scripts/event-backups',{recursive:true})
const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-')
const backup=`scripts/event-backups/before-bleach-cafe-${stamp}.json`
await writeFile(backup,JSON.stringify({events:oldEvents.data,places:oldPlaces.data},null,2),'utf8')

let place=oldPlaces.data[0]
if(!place){
  const r=await db.from('places').insert({slug:'figure-presso-fp-hongdae',name:'피규어프레소 FP점',place_type:'CAFE',addr:'서울 마포구 와우산로29길 48-11',region:'서울',district:'마포구',lat:37.55606222752837,lng:126.92755940621115,kakao_place_id:'2128926655',category_name:'가정,생활 > 유아 > 장난감,완구',parking:false,parking_note:'주차 불가'}).select('*').single()
  if(r.error)throw r.error; place=r.data
}

const image=await fetch('https://pbs.twimg.com/media/HQxjg5bawAAUDgH.jpg?name=orig')
if(!image.ok)throw new Error(`poster ${image.status}`)
const path='event-posters/bleach-thousand-year-blood-war-figurepresso-2026.jpg'
const upload=await db.storage.from('event-goods').upload(path,Buffer.from(await image.arrayBuffer()),{contentType:'image/jpeg',upsert:true})
if(upload.error)throw upload.error
const cover=db.storage.from('event-goods').getPublicUrl(path).data.publicUrl
const hours=Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day=>[day,{open:'12:00',close:'21:00'}]))
const event={tag_id:'1027065f-cc43-424a-bc69-471cc38df7fd',type:'collab_cafe',title,start_date:'2026-09-11',end_date:'2026-10-11',reserve_start:null,reserve_end:null,entry_info:'입장 방식 추후 공개',description:'TV 애니메이션 「블리치 천년혈전편」을 주제로 진행되는 공식 콜라보 카페입니다.\n\n콜라보 메뉴와 특전, 굿즈 및 입장 방식은 공식 계정을 통해 추후 공개될 예정입니다.',cover_url:cover,place_id:place.id,place_name:place.name,place_addr:place.addr,place_lat:place.lat,place_lng:place.lng,place_detail:'2층 더베이크 홍대피규어프레소FP점',parking:false,parking_note:'주차 불가',hours,hours_info:'매일 12:00~21:00\n라스트오더 20:00\n홀 마감 20:30',source_urls:['https://x.com/figurepresso_cf/status/2093157518227001419','https://figurepresso.com/fp_contect.html'],ticket_urls:[],updated_by:editor,updated_at:new Date().toISOString()}
const duplicate=await db.from('events').select('id').eq('title',title).eq('start_date',event.start_date).maybeSingle(); if(duplicate.error)throw duplicate.error
const result=duplicate.data?await db.from('events').update(event).eq('id',duplicate.data.id).select('*').single():await db.from('events').insert({...event,created_by:editor}).select('*').single()
if(result.error)throw result.error
console.log(JSON.stringify({backup,status:duplicate.data?'UPDATE':'INSERT',event:result.data},null,2))
