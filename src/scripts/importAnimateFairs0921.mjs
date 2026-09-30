// 애니메이트 공식 게시판(bdId=event sno 493·495~501) 페어 7건 + 공포게임 메이드로 살아남기 사인회 등록 (2026-09-21)
// 이미지: 공식 포스터 → covers/<sha256>.webp, 포스터에서 특전만 잘라 → compact-official-events/<sha256>.webp
// 업로드는 내용 주소 + upsert:false (lib/uploadEventImage.mjs) 라 재실행해도 객체가 늘지 않는다.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'
import { resolveSeriesKey } from './lib/seriesKey.mjs'
import { uploadEventImage } from './lib/uploadEventImage.mjs'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const dir = 'scripts/work-animate-fairs-0921'
const board = (sno) => `https://www.animate-onlineshop.co.kr/board/view.php?bdId=event&sno=${sno}`
const shopInfoUrl = 'https://www.animate-onlineshop.co.kr/main/html.php?htmid=service%2Fshopinfo.html'
const busanNoticeUrl = 'https://www.animate-onlineshop.co.kr/board/view.php?bdId=notice2&sno=46'
const ALL = ['홍대점', '잠실롯데점', '부산점', '수원점']
const NO_SUWON = ['홍대점', '잠실롯데점', '부산점']

const busanAfter1011 = '애니메이트 부산점은 매장 이전 리뉴얼로 현 매장 영업이 10월 11일(일)에 종료되고, 신규 매장은 10월 30일(금)에 문을 엽니다. 부산점에서는 10월 11일까지만 참여할 수 있습니다.'
const common = '특전은 종류를 선택할 수 없고, 준비 수량이 소진되면 행사 기간 중에도 증정이 종료됩니다. 티켓·쿠지, 온라인 쿠지·캡슐 토이, 쿠마메이트 관련 상품, 일부 TCG 등은 대상에서 제외됩니다. 온라인샵에서도 같은 기간 페어가 진행됩니다.'

const fairs = [
  {
    key: 'witch-hat-atelier', sno: 493, tagId: '484a3af3-15f1-4618-8235-96053d307aec',
    title: '고깔모자의 아틀리에 animate 페어 ~태양의 반짝임, 달의 깜박임~',
    start: '2026-09-19', end: '2026-10-04', branches: ALL,
    crop: { crop: { left: 20, top: 245, width: 960, height: 330 } },
    unit: 15000, benefit: '브로마이드 4종',
    goodsName: '고깔모자의 아틀리에 브로마이드 4종 (구매·예약 특전)',
    lead: '「고깔모자의 아틀리에」의 코코와 키프리 일러스트를 태양·달 콘셉트로 담은 애니메이트 공식 페어입니다.',
  },
  {
    key: 'jjk-culling-game', sno: 495, tagId: '7fc6cb70-c059-40e3-86a4-39dc28b6b32c',
    title: '주술회전 3기 「사멸회유」 몸단장 페어 in animate',
    start: '2026-09-19', end: '2026-10-04', branches: ALL,
    crop: { crop: { left: 432, top: 48, width: 546, height: 528 } },
    unit: 15000, benefit: '포스트카드 6종',
    goodsName: '주술회전 사멸회유 몸단장 포스트카드 6종 (구매·예약 특전)',
    lead: 'TV 애니메이션 「주술회전」 3기 「사멸회유」 방송을 기념해 이타도리 유지, 후시구로 메구미, 옷코츠 유타, 쵸소, 히구루마 히로미, 타카바 후미히코의 몸단장 일러스트를 활용한 애니메이트 공식 페어입니다.',
  },
  {
    key: 'marriagetoxin', sno: 497, tagSlug: 'marriagetoxin',
    title: '매리지 톡신 애니메이션 방송 기념 animate 페어',
    start: '2026-09-26', end: '2026-10-11', branches: NO_SUWON,
    crop: { pieces: [{ left: 30, top: 192, width: 242, height: 393 }, { left: 312, top: 380, width: 666, height: 200 }] },
    unit: 15000, benefit: '포스트카드 8종',
    goodsName: '매리지 톡신 포스트카드 8종 (구매·예약 특전)',
    lead: 'TV 애니메이션 「매리지 톡신」 방송을 기념한 애니메이트 공식 페어입니다. 수원점은 개최 매장에 포함되지 않습니다.',
  },
  {
    key: 'needy-girl-overdose', sno: 498, tagId: '4526b69f-b69a-4070-b165-5d01a71d86eb',
    title: 'NEEDY GIRL OVERDOSE animate 페어 -인터넷・엔젤 애니메이트에 지금 강림-',
    start: '2026-09-26', end: '2026-10-11', branches: ALL,
    crop: { pieces: [{ left: 45, top: 172, width: 282, height: 388 }, { left: 366, top: 350, width: 618, height: 222 }] },
    unit: 15000, benefit: '일러스트 카드 4종',
    goodsName: 'NEEDY GIRL OVERDOSE 일러스트 카드 4종 (구매·예약 특전)',
    lead: '「NEEDY GIRL OVERDOSE」의 초텐쨩과 아메쨩 일러스트를 만날 수 있는 애니메이트 공식 페어입니다.',
  },
  {
    key: 'pjsekai-autumn', sno: 499, tagId: 'f2658c7d-a3d0-4343-9b21-d0cab3d59ab8',
    title: '프로젝트 세카이 컬러풀 스테이지! feat. 하츠네 미쿠 Autumn Fair 2026 in animate',
    start: '2026-09-24', end: '2026-10-18', branches: ALL,
    crop: { crop: { left: 352, top: 38, width: 610, height: 562 } },
    unit: 15000, benefit: '박 가공 일러스트 카드 26종',
    goodsName: '프로젝트 세카이 Autumn Fair 2026 박 가공 일러스트 카드 26종 (구매·예약 특전)',
    lead: '「프로젝트 세카이 컬러풀 스테이지! feat. 하츠네 미쿠」의 가을 시즌 애니메이트 공식 페어입니다.',
    busanEarlyEnd: true,
  },
  {
    key: 'gintama', sno: 500, tagId: 'cdc27204-c7f8-4f28-a4a7-fb7e8b7fc1b7',
    title: '은혼 페어 in animate',
    start: '2026-09-26', end: '2026-10-11', branches: ALL,
    crop: { crop: { left: 38, top: 248, width: 924, height: 392 } },
    unit: 30000, benefit: '포스트카드 8종',
    goodsName: '은혼 벚꽃 포스트카드 8종 (구매·예약 특전)',
    lead: '「은혼」 캐릭터들의 벚꽃 기모노 일러스트 포스트카드를 받을 수 있는 애니메이트 공식 페어입니다.',
    extra: '특전은 영수증 1건 기준으로 증정되며 여러 영수증을 합산할 수 없습니다.',
  },
  {
    key: 'madoka', sno: 501, tagId: '734c6726-5bdc-4457-90d8-54c1f6e52319',
    title: '마법소녀 마도카☆마기카 발푸르기스의 회천 animate 페어',
    start: '2026-09-24', end: '2026-10-18', branches: NO_SUWON,
    crop: { pieces: [{ left: 733, top: 38, width: 222, height: 310 }, { left: 55, top: 362, width: 905, height: 246 }] },
    unit: 15000, benefit: '브로마이드 6종',
    goodsName: '마도카☆마기카 발푸르기스의 회천 브로마이드 6종 (구매·예약 특전)',
    lead: '극장판 「마법소녀 마도카☆마기카 〈발푸르기스의 회천〉」 개봉을 기념한 애니메이트 공식 페어입니다. 「마법소녀 마도카☆마기카 Magia Exedra」 관련 상품도 대상에 포함되며, 수원점은 개최 매장에 포함되지 않습니다.',
    busanEarlyEnd: true,
  },
]

const newTag = {
  name: '매리지 톡신', slug: 'marriagetoxin', english_name: 'MARRIAGETOXIN', ip_type: '만화,애니',
  aliases: ['マリッジトキシン', 'Marriagetoxin', 'Marriage Toxin'],
  description: '독을 다루는 암살자 가문의 게로 히카루가 결혼 상대를 찾아 나서는 액션 코미디 만화와 TV 애니메이션입니다.',
}

// ---------- 백업 ----------
const titles = [...fairs.map((f) => f.title), '공포게임 메이드로 살아남기 그라떼 개최 기념 신시어 작가 사인회']
const before = { data: [] }
for (const t of titles) {
  const r = await db.from('events').select('*').ilike('title', `${t}%`)
  if (r.error) throw r.error
  before.data.push(...r.data)
}
await mkdir('scripts/event-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(`scripts/event-backups/before-animate-fairs-0921-${stamp}.json`, JSON.stringify(before.data, null, 2))

// ---------- 지점 템플릿 (9/12 등록한 하나코 고딕 페어 4지점) ----------
const tpl = await db.from('events').select('*').ilike('title', '지박소년 하나코 군 2 고딕 스타일 페어 in animate%')
if (tpl.error) throw tpl.error
const templates = new Map(tpl.data.map((row) => [row.title.match(/\(([^)]+점)\)$/)?.[1], row]))
for (const b of ALL) if (!templates.has(b)) throw new Error(`지점 템플릿 없음: ${b}`)

// ---------- 태그 ----------
let tag = await db.from('tags').select('id').eq('slug', newTag.slug).maybeSingle()
if (tag.error) throw tag.error
if (!tag.data) {
  tag = await db.from('tags').insert({ ...newTag, created_by: editor }).select('id').single()
  if (tag.error) throw tag.error
}
for (const f of fairs) if (f.tagSlug === newTag.slug) f.tagId = tag.data.id

const out = []
async function saveEvent(event) {
  const existing = before.data.find((r) => r.title === event.title && r.start_date === event.start_date && r.end_date === event.end_date)
  const saved = existing
    ? await db.from('events').update(event).eq('id', existing.id).select('*').single()
    : await db.from('events').insert({ ...event, created_by: editor }).select('*').single()
  if (saved.error) throw saved.error
  return { saved: saved.data, status: existing ? 'UPDATED' : 'INSERTED' }
}
async function addGoods(eventId, name, imageUrl) {
  const dup = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', name).eq('is_deleted', false).maybeSingle()
  if (dup.error) throw dup.error
  if (dup.data) return 'SKIPPED_DUPLICATE'
  const ins = await db.from('event_goods').insert({
    event_id: eventId, name, kind: 'goods', price: null, image_url: imageUrl, created_by: editor, updated_by: editor,
  })
  if (ins.error) throw ins.error
  return 'INSERTED'
}

// ---------- 페어 ----------
for (const f of fairs) {
  const poster = `${dir}/${f.key}.jpg`
  const cover = await uploadEventImage(db, poster, { folder: 'covers', maxWidth: 1000 })
  const benefit = await uploadEventImage(db, poster, { folder: 'compact-official-events', maxWidth: 960, ...f.crop })
  const buy = '구매·예약' // 공식 게시판 본문 기준 (7건 모두 '구매ㆍ예약')
  const unitText = f.unit.toLocaleString('ko-KR')

  for (const branch of f.branches) {
    const t = templates.get(branch)
    const paragraphs = [
      f.lead,
      `행사 기간 중 개최 매장에서 관련 상품을 ${buy}하면 실 결제금액 ${unitText}원당 ${f.benefit} 중 1장을 랜덤으로 증정합니다. ${f.extra ? f.extra + ' ' : ''}${common}`,
    ]
    if (branch === '부산점' && f.busanEarlyEnd) paragraphs.push(busanAfter1011)
    paragraphs.push('판매 굿즈의 국내 상품별 가격과 사진은 아직 공개되지 않아, 현재 공개된 구매 특전만 안내합니다.')

    const event = {
      tag_id: f.tagId, type: 'popup', title: `${f.title} (${branch})`,
      start_date: f.start, end_date: f.end, reserve_start: null, reserve_end: null,
      entry_info: `관련 상품 ${buy} 실 결제금액 ${unitText}원당 ${f.benefit} 중 랜덤 1장 증정\n특전 소진 시 증정 종료`,
      hours: null,
      hours_info: branch === '부산점' && f.busanEarlyEnd
        ? '매장 운영시간에 따라 이용. 부산점은 매장 이전으로 10월 11일(일)까지 운영. 추석 연휴 영업시간은 지점 공지를 확인해 주세요.'
        : '매장 운영시간에 따라 이용. 추석 연휴 영업시간은 지점 공지를 확인해 주세요.',
      description: paragraphs.join('\n\n'),
      cover_url: cover.url,
      place_id: t.place_id, place_name: t.place_name, place_addr: t.place_addr,
      place_lat: t.place_lat, place_lng: t.place_lng, place_detail: t.place_detail,
      parking: t.parking, parking_note: t.parking_note,
      source_urls: [board(f.sno), shopInfoUrl, ...(branch === '부산점' && f.busanEarlyEnd ? [busanNoticeUrl] : [])],
      ticket_urls: [],
      updated_by: editor, updated_at: new Date().toISOString(),
    }
    event.shop_id = await findShopId(db, { placeId: event.place_id, addr: event.place_addr, nameHint: event.place_detail || event.place_name })
    if (event.shop_id) Object.assign(event, { place_name: null, place_addr: null, place_lat: null, place_lng: null })
    event.series_key = await resolveSeriesKey(db, { title: event.title, startDate: event.start_date, endDate: event.end_date })

    const { saved, status } = await saveEvent(event)
    const goods = await addGoods(saved.id, f.goodsName, benefit.url)
    out.push({ status, id: saved.id, title: saved.title, shop_id: saved.shop_id, series_key: saved.series_key, goods })
  }
}

// ---------- 공포게임 메이드로 살아남기 사인회 ----------
{
  const hongdae = templates.get('홍대점')
  const cover = await uploadEventImage(db, `${dir}/horror-maid-signing.jpg`, { folder: 'covers', maxWidth: 1000 })
  const event = {
    tag_id: '1798e740-15b3-4875-ad2f-3929230ce058', type: 'official_event',
    title: '공포게임 메이드로 살아남기 그라떼 개최 기념 신시어 작가 사인회',
    start_date: '2026-10-24', end_date: '2026-10-24',
    reserve_start: '2026-10-02', reserve_end: '2026-10-11',
    entry_info: '추첨제 비공개 사인회. 응모 기간(10/2 11:00~10/11 22:00) 중 애니메이트 카페 홍대점·잠실롯데점에서 콜라보 대상 상품 30,000원 이상 구매 시 응모권 1매 증정, 현장 응모함 제출. 당첨자 발표 10/16(금) 문자 개별 안내',
    hours: null, hours_info: '10월 24일(토) · 세부 시간은 당첨자에게 개별 안내',
    description: [
      '웹툰 「공포게임 메이드로 살아남기」의 애니메이트 카페 그라떼 개최를 기념해 신시어 작가 사인회가 애니메이트 홍대점 White hall에서 열립니다. 당첨자만 참석할 수 있는 비공개 추첨제 행사입니다.',
      '응모 기간은 10월 2일(금) 11:00부터 10월 11일(일) 22:00까지입니다. 애니메이트 카페 홍대점·잠실롯데점에서 콜라보 대상 상품을 30,000원 이상 구매하면 응모권 1매를 받을 수 있고, 성함과 휴대전화번호를 적어 매장 응모함에 넣으면 자동 응모됩니다. 온라인 응모는 없고, 선착순이 아닌 추첨제입니다. 당첨자는 10월 16일(금)에 응모권에 적은 번호로 개별 안내됩니다.',
      '응모권 양도와 대리 응모·참석은 불가하며, 당일 신분증으로 본인 확인을 진행합니다. 사인은 별도 사인지에 당첨자 본인 성함으로만 진행되고, 개인 물품 사인과 촬영·녹음은 할 수 없습니다. 팬레터와 선물은 현장 선물함으로 전달됩니다.',
    ].join('\n\n'),
    cover_url: cover.url,
    place_id: hongdae.place_id, place_name: hongdae.place_name, place_addr: hongdae.place_addr,
    place_lat: hongdae.place_lat, place_lng: hongdae.place_lng, place_detail: '애니메이트 홍대점 White hall',
    parking: hongdae.parking, parking_note: hongdae.parking_note,
    source_urls: [board(496)], ticket_urls: [],
    updated_by: editor, updated_at: new Date().toISOString(),
  }
  event.shop_id = await findShopId(db, { placeId: event.place_id, addr: event.place_addr, nameHint: '애니메이트 홍대점' })
  if (event.shop_id) Object.assign(event, { place_name: null, place_addr: null, place_lat: null, place_lng: null })
  event.series_key = await resolveSeriesKey(db, { title: event.title, startDate: event.start_date, endDate: event.end_date })
  const { saved, status } = await saveEvent(event)
  out.push({ status, id: saved.id, title: saved.title, shop_id: saved.shop_id, series_key: saved.series_key, goods: '-' })
}

console.log(JSON.stringify(out, null, 2))
console.log('rows:', out.length)
