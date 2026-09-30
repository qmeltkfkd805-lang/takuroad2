import fs from 'fs'
const H=(o,c)=>({open:o,close:c})
const days=['mon','tue','wed','thu','fri','sat','sun']
const wk=(...h)=>Object.fromEntries(days.map((d,i)=>[d,h[i]??h[h.length-1]]))
const SL='https://www.popmart.com/kr/store-list'
const src=(fields)=>({url:SL,fields,checked_at:'2026-09-26'})
const gsrc={url:'https://www.popmart.com/kr',fields:['goods_types'],checked_at:'2026-09-26'}
const pm=(key,name,addr,floor,phone,hours,desc,extra={})=>({action:'insert',key,brand:'팝마트',brand_links:[SL,'https://www.popmart.com/kr'],
 fields:{name,addr,floor_info:floor,cats:['굿즈샵'],phone,hours,shop_link:'https://www.popmart.com/kr',sns_links:['https://www.instagram.com/popmart_korea/'],
  description:`POP MART(팝마트) 공식 아트토이 매장입니다. ${desc}`},
 goods_types:['figure-new','keyring'],
 sources:[src(['name','addr','floor_info','phone','hours'].filter(f=>f!=='phone'||phone)),gsrc],
 unconfirmed:['closed_days','parking',...(phone?[]:['phone']),...(extra.works?[]:['works(지점 취급 IP 공식 안내 없음 — 브랜드 전체 기준 연결 안 함)'])],photo:'needed',
 notes:'전화번호는 공식 표기(하이픈 없음)의 숫자를 그대로 지역번호 형식으로 구분',...extra})
const B=H('10:30','20:00'),B2=H('10:30','20:30')
const items=[
 pm('popmart-anguk','팝마트 안국점','서울 종로구 북촌로 5',null,null,wk(H('10:00','21:00')),'안국동(북촌로)에 있으며 매일 10:00~21:00 영업합니다(공식 매장 안내).'),
 pm('popmart-hirono-gwangjang','팝마트 히로노 광장마켓점','서울 종로구 창경궁로 88',null,null,wk(H('10:00','20:00')),'히로노(HIRONO) 테마 매장으로, 매일 10:00~20:00 영업합니다(공식 매장 안내).',
  {works:[{tag_id:'668ff12d-9014-48fe-a07c-e40cf8071daa',primary:true,evidence:'팝마트 공식 매장 안내의 매장명 "POP MART 히로노 광장마켓점" (히로노 테마 매장) — 2026-09-26 확인'}]}),
 pm('popmart-centum','팝마트 신세계 센텀시티점','부산 해운대구 센텀남대로 35','신세계 센텀시티 B2 하이퍼그라운드','051-745-2383',wk(B,B,B,B,B2),'신세계 센텀시티 지하 2층 하이퍼그라운드에 있습니다. 금·토·일은 20:30까지 영업합니다(공식 매장 안내).'),
 pm('popmart-busan-samjung','팝마트 부산 삼정타워점','부산 부산진구 중앙대로 672','삼정타워 1층','051-808-6606',wk(H('11:00','22:00'),H('11:00','22:00'),H('11:00','22:00'),H('11:00','22:00'),H('11:00','22:30'),H('11:00','22:30'),H('11:00','22:00')),'서면 삼정타워 1층에 있습니다. 금·토는 22:30까지 영업합니다(공식 매장 안내).'),
 pm('popmart-starfield-anseong','팝마트 스타필드 안성점','경기 안성시 공도읍 서동대로 3930-39','스타필드 안성 2142호','031-8092-1658',wk(H('10:00','22:00')),'스타필드 안성 2142호에 있으며 매일 10:00~22:00 영업합니다(공식 매장 안내).'),
]
fs.writeFileSync(new URL('./2026-09-26.json',import.meta.url),JSON.stringify({name:'2026-09-26',items},null,1))
