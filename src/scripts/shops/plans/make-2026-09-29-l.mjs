import { writeFileSync } from 'fs'
const D = '2026-09-29'
const TAMIYA = 'https://tamiya.co.kr/sub/find_store.php'
const h = (o, c) => ({ open: o, close: c })
const days = ['mon','tue','wed','thu','fri','sat','sun']
const tamiyaSrc = (note, fields = ['name','addr','floor_info','goods_types','cats']) => ({ url: TAMIYA, fields, checked_at: D, note })
const base = { cats: ['프라모델'], goods_types: ['plamodel-new'], works: [], photo: 'needed' }
const items = [
  { ...base, action: 'insert', key: 'neighborhobby',
    fields: { name: '네이버하비 홍대점', addr: '서울 마포구 연희로 11', floor_info: '한국특허기술진흥원빌딩 1층', cats: ['프라모델'],
      shop_link: 'https://www.modelsale.com/', sns_links: ['https://www.instagram.com/neighborhobby_korea/', 'https://www.facebook.com/neighborhobby', 'https://www.youtube.com/neighborhobby'],
      phone: '02-3141-9845',
      hours: { ...Object.fromEntries(days.slice(0,5).map(d => [d, h('10:00','19:00')])), sat: h('10:00','17:00'), sun: h('10:00','17:00'), yearRound: true },
      parking: true, parking_note: '주차 가능(건물 뒤편 실외주차장·주차 리프트)\n5만원 이상 구매 시 30분 무료',
      description: '1979년 신촌과학에서 시작한 프라모델 전문점 네이버하비(Neighbor Hobby Korea, (주)엔하비)의 홍대입구역 오프라인 매장입니다. 스케일 프라모델·도료·공구와 무선모형·캐릭터 모형을 취급하며, 한국타미야 공식 취급점 목록에도 올라 있습니다.\n연중무휴 — 평일 10:00~19:00, 주말·공휴일 10:00~17:00.\n2호선 홍대입구역 3번 출구에서 경의선숲길(연트럴파크) 건너편 골목으로 도보 3분.' },
    sources: [
      { url: 'https://www.modelsale.com/modelsale/company.php', fields: ['name','addr','floor_info','phone','hours','shop_link','sns_links','parking','parking_note','description'], checked_at: D,
        note: '공식 회사소개: "홍대입구역 오프라인 매장 영업 시간 : 1년 365일 연중 무휴 - 평일 : 오전 10시 ~ 오후 7시 - 주말/공휴일 : 오전 10시 ~ 오후 5시", 주소 연희로11 한국특허기술진흥원빌딩 1층, 5만원 이상 구매시 30분 무료 주차' },
      tamiyaSrc('한국타미야 취급점 목록 "네이버하비 / 서울시 마포구 연희로 11 한국특허정보원빌딩 / t. 02-3141-9845"', ['goods_types']) ],
    unconfirmed: ['works'], notes: '매장 이름은 공식 표기 "홍대입구역 오프라인 매장"을 지점명 "홍대점"으로. 건물은 단독(place 없음)' },
  { ...base, action: 'insert', key: 'bigbox',
    fields: { name: '빅박스(BIG BOX)', addr: '서울 양천구 중앙로 304', floor_info: '지하 B01호', cats: ['프라모델'],
      shop_link: 'https://big-box.kr/', sns_links: [], phone: '02-6406-8278',
      description: '타미야 미니 4WD(미니카) 전문점이자 "타미야 빅박스 서울공인경기장"을 운영하는 매장입니다. 미니카 키트·파츠·가공 부품을 판매하고 정기 레이스를 엽니다.\n화·금요일은 정기 휴무(공식 홈페이지 기준)이며, 레이스·임시 휴무 일정은 공식 홈페이지 "일정" 에서 확인하세요.' },
    sources: [
      { url: 'https://big-box.kr/', fields: ['name','addr','phone','shop_link','description'], checked_at: D,
        note: '공식 홈페이지: 주소 "서울특별시 양천구 중앙로 304 지하 빅박스", 전화 02-6406-8278, "휴무 : 화,금요일", 상품명 "타미야 빅박스 서울공인경기장", 상단 "다음 출고 10/1 … 휴무 9/29(화), 10/1(목), 10/2(금)"' },
      tamiyaSrc('한국타미야 취급점 목록 "빅박스(BIG BOX) / 서울 양천구 중앙로 304 지층 B01호 / t. 02-6406-8278"', ['name','floor_info','goods_types']) ],
    unconfirmed: ['hours','works'], notes: '홈페이지 시간(월·수·목 19:30~23:00, 토 13:00~20:00, 일 13:00~19:00)은 "CUSTOMER CENTER" 표기라 매장 시간으로 넣지 않음' },
  { ...base, action: 'insert', key: 'toyfactory-daegu',
    fields: { name: '토이팩토리 대구', addr: '대구 수성구 만촌로 6', floor_info: '2층', cats: ['프라모델'],
      shop_link: 'https://minicarshop.co.kr/', sns_links: ['https://cafe.naver.com/tnfminicar'], phone: '010-2242-0700',
      description: '타미야 미니 4WD(미니카) 기본 킷·파츠·자체 가공 부품과 프라모델을 판매하는 미니카샵입니다(한국타미야 공식 취급점).\n신상품 입고·매장 오픈 소식은 토이팩토리 네이버 카페에 공지합니다.' },
    sources: [
      { url: 'https://minicarshop.co.kr/', fields: ['name','addr','floor_info','phone','shop_link','description'], checked_at: D,
        note: '공식 쇼핑몰 하단 "대구광역시 수성구 만촌로 6 (만촌동) 2층 토이팩토리", 2026년 설 연휴 안내 공지(2026-02-12). 고객센터 "평일 12시~18시, 토 12시~17시, 일요일 휴무"는 CALL CENTER 표기' },
      { url: 'https://minicarshop.co.kr/article/공지사항/1/8740/', fields: ['sns_links'], checked_at: D, note: '공지: 매장오픈 안내는 네이버 카페 cafe.naver.com/tnfminicar' },
      tamiyaSrc('한국타미야 취급점 목록 "토이팩토리 / 대구광역시 수성구 만촌로6, 2층 / t. 010-2242-0700"') ],
    unconfirmed: ['hours','works'], notes: '고객센터 시간은 매장 시간으로 넣지 않음' },
  { ...base, action: 'insert', key: 'hobbyland-daegu',
    fields: { name: '하비랜드 대구', addr: '대구 중구 중앙대로 434', floor_info: '2층', cats: ['프라모델'],
      shop_link: TAMIYA, sns_links: [],
      description: '대구 중앙로의 프라모델 전문점으로, 한국타미야 공식 취급점 목록에 올라 있습니다. 매장 자체 공식 채널이 없어 영업시간·전화는 방문 전 확인하세요.' },
    sources: [ tamiyaSrc('한국타미야 취급점 목록 "하비랜드 / 대구 중구 중앙대로 434 2층 / t. 053-725-7866"') ],
    unconfirmed: ['hours','phone','official_channel','works'], notes: '전화: 타미야 목록 053-725-7866 ↔ 지역 업체 목록·검색 053-425-7866 불일치 — 비움. 검색 요약 "11~21시, 화요일 휴무"는 공식 아님' },
  { ...base, action: 'insert', key: 'hobbyhill-daegu',
    fields: { name: '하비힐', addr: '대구 중구 명덕로 275', floor_info: '2층', cats: ['프라모델'],
      shop_link: TAMIYA, sns_links: [], phone: '010-3516-9456',
      description: '대구 건들바위역 인근의 스케일 모형 전문점으로, 한국타미야 공식 취급점 목록에 올라 있습니다. 매장 자체 공식 채널이 없어 영업시간은 방문 전 확인하세요.' },
    sources: [ tamiyaSrc('한국타미야 취급점 목록 "하비힐 / 대구광역시 중구 명덕로 275 2층 하비힐 / t. 010-3516-9456"', ['name','addr','floor_info','phone','goods_types','cats']),
      { url: 'https://mmzone.co.kr/mms_tool/mt_view.php?mms_db_name=mmz_media&mms_cat=%5B%ED%94%BC%ED%94%8C%5D&no=2296', fields: [], checked_at: D, note: '발견용(모형 커뮤니티 인터뷰 — 건들바위역 4번 출구). 값 출처 아님' } ],
    unconfirmed: ['hours','official_channel','works'] },
]
writeFileSync('scripts/shops/plans/2026-09-29-l.json', JSON.stringify({ name: '2026-09-29-l', items }, null, 1))
console.log(items.length)
