import fs from 'fs'
const H=(o,c)=>({open:o,close:c})
const week=(wd,we)=>({mon:wd,tue:wd,wed:wd,thu:wd,fri:we,sat:we,sun:we})
const GB='https://www.bnkrmall.co.kr/etc/gundam-base_store.do', GBO='https://www.bnkrmall.co.kr/etc/gashapon-official_store.do', FS='https://www.bnkrmall.co.kr/etc/funsquare_store.do'
const brandLinks=[GB,GBO,FS,'https://cafe.naver.com/gbasekorea']
const gbWorks=[{slug:'gundam',evidence:'건담베이스 = 반다이남코 건담 프라모델 공식 매장(단일 IP 브랜드 매장, 브랜드 기준)'}]
const src=(url,fields)=>({url,fields,checked_at:'2026-09-23'})
const gb=(key,name,addr,floor,phone,hours,desc,unconf=['parking'])=>({action:'insert',key,brand:'건담베이스',brand_links:brandLinks,
 fields:{name,addr,floor_info:floor,cats:['굿즈샵','프라모델'],phone,hours,shop_link:GB,sns_links:['https://cafe.naver.com/gbasekorea'],
 description:`반다이남코코리아가 운영하는 건담 프라모델(건프라) 공식 매장입니다. ${desc}`},
 works:gbWorks,goods_types:['plamodel-new'],sources:[src(GB,['name','addr','floor_info','phone','hours'])],unconfirmed:unconf,photo:'needed'})
const items=[
 gb('gundam-base-goyang','건담베이스 고양점','경기 고양시 덕양구 고양대로 1955','스타필드 고양 2층 (일렉트로마트 옆)','031-5173-2479',week(H('10:00','22:00'),H('10:00','22:00')),'스타필드 고양 2층 일렉트로마트 옆에 있습니다. 스타필드 고양 지정 휴일에는 휴무입니다(공식 안내).'),
 gb('gundam-base-pangyo','건담베이스 판교점','경기 성남시 분당구 판교역로146번길 20','현대백화점 판교점 5층','031-5170-1551',week(H('10:30','20:00'),H('10:30','20:30')),'현대백화점 판교점 5층에 있습니다. 금·토·일·공휴일은 20:30까지 영업합니다(공식 안내).',['closed_days','parking']),
 gb('gundam-base-centum','건담베이스 센텀시티점','부산 해운대구 센텀남대로 35','신세계백화점 센텀시티몰 3층','051-745-1468',week(H('10:30','20:00'),H('10:30','20:30')),'신세계백화점 센텀시티몰 3층에 있습니다. 금·토·일·공휴일은 20:30까지 영업하며, 월 1회 월요일 휴무입니다(공식 안내).'),
 gb('gundam-base-daejeon','건담베이스 대전점','대전 동구 동서대로1695번길 30','대전복합터미널 동관 2층','042-625-2805',week(H('11:00','21:00'),H('11:00','21:00')),'대전복합터미널 동관 2층에 있습니다.',['closed_days','parking']),
 {action:'insert',key:'gashapon-gimpo-airport',brand:'가샤폰',brand_links:brandLinks,
  fields:{name:'가샤폰 롯데몰 김포공항점',addr:'서울 강서구 하늘길 38',floor_info:'롯데몰 김포공항점 GF층 (펀스퀘어 롯데몰 김포공항점 내)',cats:['가챠'],phone:'02-6116-5053',
   hours:week(H('10:30','22:00'),H('10:30','22:00')),shop_link:GBO,
   description:'반다이 공식 캡슐토이 매장 "가샤폰 반다이 오피셜숍"입니다. 롯데몰 김포공항점 GF층 펀스퀘어 안에 있습니다.'},
  goods_types:['gacha-new'],sources:[src(GBO,['name','addr','floor_info','phone','hours']),src(FS,['floor_info'])],unconfirmed:['closed_days','works(지점별 라인업 공식 목록 없음)'],photo:'needed'},
]
fs.writeFileSync(new URL('./2026-09-23-h.json',import.meta.url),JSON.stringify({name:'2026-09-23-h',items},null,1))
