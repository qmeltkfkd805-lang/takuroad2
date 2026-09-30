import fs from 'fs'
const H=(o,c)=>({open:o,close:c})
const days=['mon','tue','wed','thu','fri','sat','sun']
const wk=(...h)=>Object.fromEntries(days.map((d,i)=>[d,h[i]??h[h.length-1]]))
const D='2026-09-26'
const ADDR='서울 서초구 효령로 304'
const BLD='국제전자센터'
const CLOSE='매월 첫째·셋째 일요일은 휴무입니다(국제전자센터 상가 전체 휴무일).'
const S=(url,fields)=>({url,fields,checked_at:D})
const W=(tag_id,evidence,primary=false)=>({tag_id,evidence,...(primary?{primary}:{})})
const T={dandadan:'82faacc1-27fc-4300-949a-f7742791e6b1',lupin:'e304a4ec-9449-45fd-9f7c-e63a77962c0a',holo:'ac52f935-18c9-4f95-b87a-bece558a74fe',bisque:'e5e3810f-0e71-46c2-afb5-99f80b228541',
 mha:'b6a65af7-85e0-4390-9986-6057487c19d1',hxh:'c0abe340-8f54-4c4d-b9e5-13dbb1ed7a47',aot:'46d1cc6a-f88b-46e2-b4ec-d70dcf0be740',jjk:'7fc6cb70-c059-40e3-86a4-39dc28b6b32c',chiikawa:'b507243e-1408-47a1-9aeb-f4245127d3dc',
 sanrio:'f6dff3d1-5a30-409d-849c-9a34d111b1be',shinchan:'5c4e930c-a5f4-4e5e-a9f0-93b3d705aae7',mofusand:'117de9bc-09d7-4481-9475-4c0fec7f9382',ghibli:'ec323eb8-d8d4-427f-a18e-e5e785a3552a',frieren:'fb8c03af-9bdc-4fb2-8fef-8d9a7792873c',
 digimon:'4b229a09-369d-4607-9d3b-04aa3f128c2c',bluelock:'77a9bc04-00de-4071-baf2-571f4fcef31d',patissiere:'8bc31a60-e2cc-433f-9b18-53dde098b7c8',gintama:'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7',mob:'a5f74dd1-1b7d-4c44-83e6-b88054dc0216',
 keroro:'41e73c70-0c1c-4950-9a01-4c0fd75820c5',genshin:'49f4d824-0ef6-4926-80ea-8dd5f930000e',hsr:'4613169d-2461-48a6-92fe-a97a674d2a34',bluearchive:'32995c8f-a09f-4a45-8efc-47a5e3b51e8a',nikke:'63f2a778-7dca-469d-a2c1-8b139d82637f',
 zzz:'a6be5443-1fa4-460b-b408-fe9a72a505d9',danganronpa:'78defc03-2cc1-4c05-824f-543ead1c0e53'}
const ins=(key,f,extra)=>({action:'insert',key,fields:{addr:ADDR,...f},photo:'needed',...extra})
const FP='https://x.com/figurepresso', AG='https://x.com/animegoods_fp', ES='https://x.com/E_staregg_store', ES2='https://x.com/E_stareggstore2', TT='https://x.com/ttabbaemall', SK='https://x.com/skytoy_shop', DS='https://www.threads.com/@ddansol_shop'
const items=[
 ins('figurepresso-seocho',{name:'피규어프레소 서초점',floor_info:`${BLD} 9층 (1~3호점)`,cats:['굿즈샵'],phone:'010-9526-7330',hours:wk(H('11:00','20:00')),
   shop_link:'https://figurepresso.com',sns_links:[FP],
   description:'피규어프레소 국전점(1~3호점)으로, 남부터미널역 국제전자센터 9층에 있는 정품 피규어 전문 매장입니다. 매일 11:00~20:00 영업하며, 매월 첫째·셋째 일요일과 공휴일은 휴무입니다(공식 안내). 재고 문의는 공식 X DM으로 받습니다.'},
  {brand:'피규어프레소',brand_links:['https://figurepresso.com'],goods_types:['figure-new'],
   works:[W(T.dandadan,'공식 X "서초 오프라인 입고 완료" 2026-07-22 (단다단 바이브레이션 스타즈)'),W(T.lupin,'공식 X 서초 오프라인 입고 2026-07-22 (지겐 다이스케 피규어)'),W(T.holo,'공식 X 서초 오프라인 입고 2026-07-22 (유키하나 라미)'),W(T.bisque,'공식 X 서초 오프라인 입고 2026-07-22 (키타가와 마린)')],
   sources:[S('https://figurepresso.com',['name','phone','hours','closed_days']),S(FP,['floor_info','hours','works'])],unconfirmed:['parking']}),
 ins('animegoods-kukje',{name:'애니메굿즈',floor_info:`${BLD} 9층 001~003호`,cats:['굿즈샵'],shop_link:AG,sns_links:[AG],
   description:`국제전자센터 9층 001~003호에 있는 애니메이션 굿즈·피규어 전문 오프라인 매장입니다(공식 X). 3호선 남부터미널역에서 가깝습니다. ${CLOSE}`},
  {goods_types:['figure-new','card-new'],
   works:[W(T.patissiere,'공식 X "매장 입고완료" 2026-09-23 (트레이딩 브로마이드)'),W(T.gintama,'공식 X 매장 입고 2026-09-23 (트레이딩 아크릴 미니 블록)'),W(T.mob,'공식 X 매장 입고 2026-09-23 (트레이딩 일러스트 카드)'),W(T.keroro,'공식 X 매장 입고 2026-09-23 (캐릭터 포트레이트)')],
   sources:[S(AG,['name','floor_info','works','goods_types'])],unconfirmed:['hours','phone','parking'],notes:'첫째·셋째 일요일 휴무는 건물 전체 휴무(따빼몰·이스타에그 공식 공지) 기준'}),
 ins('estaregg-kukje-main',{name:'이스타에그 국전 본점',floor_info:`${BLD} 7층`,cats:['굿즈샵','카드/TCG'],hours:wk(H('11:00','19:30')),shop_link:'https://estar-egg.com',sns_links:[ES,ES2],
   description:'게임·애니메이션 서브컬처 상품을 판매하는 이스타에그의 오프라인 매장(본점)으로, 국제전자센터 7층에 있습니다. 매일 11:00~19:30 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 X). 2호점은 같은 건물 9층에 있습니다.'},
  {brand:'이스타에그',brand_links:['https://estar-egg.com'],goods_types:['figure-new','card-new','plushie-new'],
   works:[W(T.holo,'공식 X 국전 본점 입고안내 2026-09-19 (홀로라이브 오피셜 카드게임)'),W(T.nikke,'공식 X 국전 본점 입고안내 2026-09-17~19 (니케 굿스마일·푸치슈·바이스 슈발츠)'),W(T.bluearchive,'공식 X 국전 본점 입고안내 2026-09-18 (유메미라이즈 피규어)'),W(T.hsr,'공식 X 국전 본점 입고안내 2026-09-17 (허기굿스마일 스파키)'),W(T.danganronpa,'공식 X 국전 본점 입고안내 2026-09-17 (단간론파: 절대절망소녀)')],
   sources:[S(ES,['name','floor_info','hours','closed_days','works','goods_types']),S('https://estar-egg.com',['shop_link'])],unconfirmed:['phone','parking']}),
 ins('estaregg-kukje-2',{name:'이스타에그 국전 2호점',floor_info:`${BLD} 9층`,cats:['굿즈샵'],shop_link:'https://estar-egg.com',sns_links:[ES2,ES],
   description:'이스타에그의 오프라인 2호점으로 국제전자센터 9층에 있습니다. 매주 화요일 정기휴무입니다(공식 X). 본점은 같은 건물 7층에 있습니다.'},
  {brand:'이스타에그',brand_links:['https://estar-egg.com'],
   sources:[S(ES2,['name','floor_info','closed_days'])],unconfirmed:['hours(공식 X 운영시간 14:30~19:30·점심 13:30~14:30 표기가 서로 맞지 않아 비움)','phone','works','goods_types']}),
 ins('ttabbaemall-kukje',{name:'따빼몰 국제전자센터점',floor_info:`${BLD} 3층 81~83·88호`,cats:['굿즈샵'],hours:wk(H('11:30','19:00')),shop_link:'https://ttabbaemall.co.kr',sns_links:[TT],
   description:'애니메이션풍 서브컬처 게임 캐릭터 굿즈샵 따빼몰의 오프라인 매장으로, 국제전자센터 3층에 있습니다. 11:30~19:00 영업하며 일요일도 운영하지만 매월 첫째·셋째 일요일은 휴무입니다(공식 X).'},
  {brand:'따빼몰',brand_links:['https://ttabbaemall.co.kr'],goods_types:['figure-new','acrylic-stand','plushie-new','keyring'],
   works:[W(T.genshin,'공식 X 오프라인 매장 안내(주요 판매) + 2026-09-19 매장 신규 입고'),W(T.hsr,'공식 X 주요 판매 + 2026-09-19 매장 입고 (스파키 피규어)'),W(T.zzz,'공식 X 오프라인 매장 안내 주요 판매 (2024-12-19, 고정 게시물)'),W(T.bluearchive,'공식 X 2026-09-19 매장 신규 입고·재입고'),W(T.nikke,'공식 X 2026-09-19 매장 입고 (도로시 누들스토퍼)')],
   sources:[S(TT,['name','addr','floor_info','hours','closed_days','works','goods_types'])],unconfirmed:['phone','parking','sun_hours(일요일 운영 명시, 시간은 월~토와 같게 둠)']}),
 ins('brothergoods-kukje',{name:'브라더굿즈 국제전자센터점',floor_info:`${BLD} 3층 3023~3027·3086~3087·3096~3099호`,cats:['가챠','쿠지'],hours:wk(H('10:00','20:00')),shop_link:'https://www.instagram.com/brother.goods.kukje/',sns_links:['https://www.instagram.com/brother.goods.kukje/'],
   description:'다양한 굿즈 가챠와 브라더 쿠지를 운영하는 매장으로, 국제전자센터 3층에 있습니다. 매일 10:00~20:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 인스타그램).'},
  {brand:'브라더굿즈',goods_types:['gacha-new','self-kuji'],
   sources:[S('https://www.instagram.com/brother.goods.kukje/',['name','floor_info','hours','closed_days','goods_types'])],unconfirmed:['phone','parking','works']}),
 ins('hanwoori-kukje',{name:'한우리 국제전자센터점',floor_info:`${BLD} 9층 114호`,cats:['게임샵'],phone:'02-3465-0048',hours:wk(H('10:00','20:00')),shop_link:'https://www.gamewoori.com',sns_links:['https://www.instagram.com/hanwooriofficial/'],
   description:'PlayStation·닌텐도 스위치 등 콘솔 게임과 게임 굿즈를 판매하는 게임샵 한우리(겜우리)의 국제전자센터 매장으로, 9층 114호에 있습니다. 매일 10:00~20:00 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 안내).'},
  {brand:'한우리',brand_links:['https://www.gamewoori.com'],
   sources:[S('https://www.gamewoori.com',['name','phone','hours','closed_days']),S('https://www.instagram.com/hanwooriofficial/',['floor_info','phone','hours'])],unconfirmed:['parking','works','goods_types','한우리 스토어(02-3465-0049) 위치 — 별도 매장 여부 미확인']}),
 ins('miraclekuji-kukje',{name:'미라클쿠지 국전점',floor_info:`${BLD} 3층 41호 (1호점·2호점)`,cats:['쿠지','가챠'],hours:wk(H('11:00','20:00')),shop_link:'https://www.miraclekuji.com',sns_links:['https://www.instagram.com/miracle_kuji/'],
   description:"반다이 정품 제일복권(이치방쿠지)과 미라클쿠지 자체쿠지, 캡슐토이를 판매하는 미라클쿠지 본점(국전점)으로, 국제전자센터 3층에 있습니다. 매일 11:00~20:00 영업합니다(공식 매장 안내). 문의는 카카오톡 채널 '미라클쿠지'로 받습니다."},
  {brand:'미라클쿠지',brand_links:['https://www.miraclekuji.com'],goods_types:['ichiban-kuji','self-kuji','gacha-new'],
   sources:[S('https://www.miraclekuji.com',['name','addr','floor_info','hours','goods_types']),S('https://www.instagram.com/miracle_kuji/',['floor_info'])],unconfirmed:['phone','parking','closed_days(공식은 매일 영업 — 건물 휴무일 적용 여부 미확인)','works(원피스 등은 3개 매장 공통 안내 — 지점 미확인)']}),
 ins('skytoy-kukje',{name:'스카이토이 국전',floor_info:`${BLD} 3층 3134호`,cats:['굿즈샵','가챠','쿠지'],hours:wk(H('10:00','20:00')),shop_link:'https://linktr.ee/skytoy',sns_links:[SK],
   description:'가챠·쿠지·피규어를 판매하는 애니굿즈샵으로, 국제전자센터 3층 3134호에 있습니다. 매일 10:00~20:00 영업하며 매월 첫째·셋째 일요일은 정기휴무입니다. 오프라인 매장에서만 판매하며 문의는 카카오톡 채널로 받습니다(공식 X).'},
  {goods_types:['gacha-new','ichiban-kuji','figure-new','plushie-new'],
   works:[W(T.mha,'공식 X 쿠지 입고 안내 https://x.com/skytoy_shop/status/2017084160381493618'),W(T.hxh,'공식 X 쿠지 입고 https://x.com/skytoy_shop/status/1998580656889340273'),W(T.aot,'공식 X 쿠지 입고 https://x.com/skytoy_shop/status/2055394905414131799'),W(T.jjk,'공식 X 쿠지 입고 https://x.com/skytoy_shop/status/2009823983571742857'),W(T.chiikawa,'공식 X 매장 입고 (포동포동 껴안는 인형) https://x.com/skytoy_shop/status/2068147995032604761')],
   sources:[S(SK,['name','floor_info','hours','closed_days','goods_types','works'])],unconfirmed:['phone','parking']}),
 ins('ddansol-kukje',{name:'딴솔샵',floor_info:`${BLD} 8층 155~157호`,cats:['굿즈샵'],hours:wk(H('11:00','19:30')),shop_link:DS,sns_links:[DS],
   description:'치이카와·산리오·짱구·모후샌드·지브리 굿즈와 피규어, 제일복권을 판매하는 굿즈샵으로, 국제전자센터 8층에 있습니다. 11:00~19:30 영업하며 매월 첫째·셋째 일요일은 휴무입니다(공식 Threads, 2026-08 공지).'},
  {goods_types:['figure-new','ichiban-kuji'],
   works:[W(T.chiikawa,'공식 Threads 프로필 취급 표기(먼작귀)',true),W(T.sanrio,'공식 Threads 프로필 취급 표기',true),W(T.shinchan,'공식 Threads 프로필 취급 표기(짱구)',true),W(T.mofusand,'공식 Threads 프로필 취급 표기(모후샌드)'),W(T.ghibli,'공식 Threads 프로필 취급 표기(지브리)'),
     W(T.mha,'공식 Threads 2026-08-05 메가하우스 룩업 입고'),W(T.digimon,'공식 Threads 2026-08-05 룩업 디지몬어드벤처 아구몬 입고'),W(T.frieren,'공식 Threads 2026-08-05 룩업 힘멜·프리렌 입고'),W(T.bluelock,'공식 Threads 제일복권 블루록 입고 https://www.threads.com/@ddansol_shop/post/DZG_FDrkT3-')],
   sources:[S(DS,['name','floor_info','hours','closed_days','works','goods_types'])],unconfirmed:['phone','parking','hours(다른 게시물에 12:00~20:00 표기 — 최신 2026-08 공지 기준)']}),
]
fs.writeFileSync(new URL('./2026-09-26-b.json',import.meta.url),JSON.stringify({name:'2026-09-26-b',items},null,1))
