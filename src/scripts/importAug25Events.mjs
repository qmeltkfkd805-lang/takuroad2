import { createClient } from '@supabase/supabase-js'

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const now=new Date().toISOString()
const daily=(open,close)=>Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(d=>[d,{open,close}]))
async function tag(name,slug){let r=await db.from('tags').select('*').eq('slug',slug).maybeSingle();if(r.error)throw r.error;if(!r.data)r=await db.from('tags').select('*').eq('name',name).maybeSingle();if(r.error)throw r.error;if(!r.data)r=await db.from('tags').insert({name,slug}).select('*').single();if(r.error)throw r.error;return r.data}
async function place(kakao){const r=await db.from('places').select('*').eq('kakao_place_id',kakao).single();if(r.error)throw r.error;return r.data}
const [conan,aipri,ak,ipark,uplex]=await Promise.all([tag('명탐정 코난','detective-conan'),tag('비밀의 아이프리','himitsu-no-aipri'),place('1156421273'),place('7990380'),place('26992232')])
const p=(v,detail)=>({place_id:v.id,place_name:v.name,place_addr:v.addr,place_lat:v.lat,place_lng:v.lng,place_detail:detail,parking:v.parking,parking_note:v.parking_note})
const base={reserve_start:null,reserve_end:null,ticket_urls:[],updated_at:now}
const events=[
 {...base,tag_id:conan.id,type:'collab_cafe',title:'명탐정 코난 × BOX cafe&space 콜라보 카페',start_date:'2026-08-13',end_date:'2026-09-20',entry_info:'현장 선착순 입장',description:'극장판 「명탐정 코난: 하이웨이의 타천사」를 테마로 빈티지와 마린 두 시즌을 선보이는 콜라보 카페입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-06/94654f82-349d-462f-b185-a4a078689dcd.jpg',...p(ak,'3층 BOX cafe&space'),hours:daily('10:30','22:00'),hours_info:'매일 10:30~22:00',source_urls:['https://x.com/BOX_CAFE_AK']},
 {...base,tag_id:aipri.id,type:'collab_cafe',title:'비밀의 아이프리 × MOAE:KU 콜라보 카페 (신촌점)',start_date:'2026-08-28',end_date:'2026-09-20',entry_info:'현장 선착순 입장',description:'「비밀의 아이프리」 첫 공식 콜라보 카페입니다. 한국 오리지널 일러스트를 활용한 메뉴와 상품, 특전을 선보입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-21/9aa8c904-9edc-49a5-b08a-d4c5d23305f1.jpg',...p(uplex,'지하 2층 MOAE:KU'),hours:daily('10:30','22:00'),hours_info:'매일 10:30~22:00',source_urls:['https://x.com/MOAEKU','https://x.com/prettyseries_KR']},
 {...base,tag_id:aipri.id,type:'popup',title:'비밀의 아이프리 × MOAE:KU 팝업스토어 (용산점)',start_date:'2026-08-28',end_date:'2026-09-28',entry_info:'현장 선착순 입장',description:'「비밀의 아이프리」 한국 오리지널 일러스트를 활용한 상품과 F&B, 특전을 함께 선보이는 팝업스토어입니다.',cover_url:'https://media.orings.co.kr/static/place/2026-08-21/59bb9261-18e1-4459-8bd2-3bdb105ef495.jpg',...p(ipark,'리빙파크 6층 MOAE:KU'),hours:{mon:{open:'10:30',close:'20:30'},tue:{open:'10:30',close:'20:30'},wed:{open:'10:30',close:'20:30'},thu:{open:'10:30',close:'20:30'},fri:{open:'10:30',close:'21:00'},sat:{open:'10:30',close:'21:00'},sun:{open:'10:30',close:'20:30'}},hours_info:'월~목·일 10:30~20:30\n금·토 10:30~21:00',source_urls:['https://x.com/MOAEKU2','https://x.com/prettyseries_KR']},
]
const out=[]
for(const e of events){const old=await db.from('events').select('id').eq('title',e.title).eq('start_date',e.start_date).maybeSingle();if(old.error)throw old.error;const r=old.data?await db.from('events').update(e).eq('id',old.data.id).select('id,title,start_date,end_date,place_name,place_detail,hours_info,entry_info,cover_url,source_urls,ticket_urls').single():await db.from('events').insert(e).select('id,title,start_date,end_date,place_name,place_detail,hours_info,entry_info,cover_url,source_urls,ticket_urls').single();if(r.error)throw r.error;out.push({status:old.data?'UPDATE':'INSERT',...r.data})}
console.log(JSON.stringify(out,null,2))
