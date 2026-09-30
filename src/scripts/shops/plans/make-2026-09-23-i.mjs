import fs from 'fs'
const H=(o,c)=>({open:o,close:c})
const days=['mon','tue','wed','thu','fri','sat','sun']
const wk=(...h)=>Object.fromEntries(days.map((d,i)=>[d,h[i]??h[h.length-1]]))
const SL='https://www.popmart.com/kr/store-list'
const src=(fields)=>({url:SL,fields,checked_at:'2026-09-23'})
const gsrc={url:'https://www.popmart.com/kr',fields:['goods_types'],checked_at:'2026-09-23'}
const pm=(key,name,addr,floor,phone,hours,desc)=>({action:'insert',key,brand:'팝마트',brand_links:[SL,'https://www.popmart.com/kr'],
 fields:{name,addr,floor_info:floor,cats:['굿즈샵'],phone,hours,shop_link:'https://www.popmart.com/kr',sns_links:['https://www.instagram.com/popmart_korea/'],
  description:`POP MART(팝마트) 공식 아트토이 매장입니다. ${desc}`},
 goods_types:['figure-new','keyring'],
 sources:[src(['name','addr','floor_info','phone','hours']),gsrc],
 unconfirmed:['closed_days','parking','works(지점 취급 IP 공식 안내 없음 — 브랜드 전체 기준 연결 안 함)'],photo:'needed',
 notes:'전화번호는 공식 표기(하이픈 없음)의 숫자를 그대로 지역번호 형식으로 구분'})
const items=[
 pm('popmart-myeongdong','팝마트 명동 프리미엄 테마샵','서울 중구 명동8길 36',null,'02-319-9968',wk(H('11:00','22:00')),'명동에 있으며 매일 11:00~22:00 영업합니다(공식 매장 안내).'),
 pm('popmart-thehyundai','팝마트 더현대 서울점','서울 영등포구 여의대로 108','더현대 서울 지하 2층','02-3277-0854',wk(H('10:30','20:00'),H('10:30','20:00'),H('10:30','20:00'),H('10:30','20:00'),H('10:30','20:30')),'더현대 서울 지하 2층에 있습니다. 금·토·일은 20:30까지 영업합니다(공식 매장 안내).'),
 pm('popmart-starfield-goyang','팝마트 스타필드 고양점','경기 고양시 덕양구 고양대로 1955','스타필드 고양 3층','031-5173-3036',wk(H('10:00','22:00')),'스타필드 고양 3층에 있습니다.'),
 pm('popmart-coex','팝마트 코엑스점','서울 강남구 봉은사로 524','코엑스몰 B1층 메가박스 입구','02-6002-6601',wk(H('11:00','21:00'),H('11:00','21:00'),H('11:00','21:00'),H('11:00','21:00'),H('11:00','22:00')),'코엑스몰 지하 1층 메가박스 입구에 있습니다. 금·토·일은 22:00까지 영업합니다(공식 매장 안내).'),
 pm('popmart-hongdae','팝마트 홍대 플래그십 스토어','서울 마포구 와우산로23길 56',null,'02-6371-0702',wk(H('11:00','22:00')),'홍대 플래그십 스토어로, 매일 11:00~22:00 영업합니다(공식 매장 안내).'),
 {action:'update',key:'popmart-suwon',shop_id:'f194103b-ae01-456c-86f7-29224f17fe41',expect_updated_at:'2026-09-23T06:22:12.021362+00:00',fields:{floor_info:'4층 4174호',phone:'0507-1406-1505'},
  reason:'팝마트 공식 매장 안내(2026-09-23) — 스타필드 수원 4층 4174호, 전화 0507-14061505. 영업시간 10:00~22:00 은 기존 값과 같음',
  sources:[src(['floor_info','phone','hours'])]},
 {action:'update',key:'popmart-yongsan',shop_id:'298c8675-96ea-409f-b768-f25818b64e91',expect_updated_at:'2026-09-23T06:13:16.309111+00:00',fields:{floor_info:'아이파크몰 용산 리빙파크 6층'},overwrite:['floor_info'],
  reason:'팝마트 공식 매장 안내(2026-09-23) — "아이파크몰 용산 리빙파크 6층". 전화·영업시간은 기존 값과 같음',
  sources:[src(['floor_info','phone','hours'])]},
]
fs.writeFileSync(new URL('./2026-09-23-i.json',import.meta.url),JSON.stringify({name:'2026-09-23-i',items},null,1))
