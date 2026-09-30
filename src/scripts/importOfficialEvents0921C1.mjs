// 공식 확인분 C-1 (2026-09-21): 오란고교 사교클럽 SMG CAFE(티저) · 유희왕 POP-UP STORE 2026(티저) · 롯데월드 × 이토준지 컬렉션
// 오란고교·유희왕은 공식 COMING SOON 티저만 공개된 상태라 확정된 기간·장소만 넣고, 세부는 추후 공지로 안내한다.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { uploadEventImage } from './lib/uploadEventImage.mjs'
import { openBatch } from './lib/eventBatch.mjs'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const dir = 'scripts/work-official-0921'

const T = {
  ouran: '오란고교 사교클럽 × SMG CAFE 콜라보 카페',
  yugioh: '유희왕 POP-UP STORE 2026',
  ito: '롯데월드 × 이토준지 컬렉션 가을 시즌 「기묘한 세계의 초대」',
}
const batch = await openBatch(db, { name: 'official-0921-c1', editor, titles: Object.values(T) })
const rowById = async (id) => { const r = await db.from('events').select('*').eq('id', id).single(); if (r.error) throw r.error; return r.data }
const epic7 = await rowById('452ecf4d-45cf-4e4d-a9f9-a76b33afd3aa')   // 현대백화점유플렉스 신촌점 지하 2층 SMG CAFE
const harry = await rowById('e315dfb6-024a-4fa1-850f-2432d8d0fd5c')   // 아이파크몰 용산점 리빙파크 3층 도파민 스테이션
const place = (tpl, detail) => ({
  place_id: tpl.place_id, place_name: tpl.place_name, place_addr: tpl.place_addr,
  place_lat: tpl.place_lat, place_lng: tpl.place_lng, place_detail: detail, parking: tpl.parking, parking_note: tpl.parking_note,
})
const out = []
const record = (status, saved, goods = []) => out.push({ status, id: saved.id, title: saved.title, shop_id: saved.shop_id, series_key: saved.series_key, goods: goods.join('') })

// ---------- 오란고교 사교클럽 × SMG CAFE ----------
{
  const cover = await uploadEventImage(db, `${dir}/ouran-smgcafe/ig_teaser_poster.jpg`, { folder: 'covers', maxWidth: 1080 })
  const { saved, status } = await batch.saveEvent({
    tag_id: '4d4b02e7-2835-45ce-8357-c92992d69387', type: 'collab_cafe', title: T.ouran,
    start_date: '2026-10-02', end_date: '2026-11-30', reserve_start: null, reserve_end: null,
    entry_info: '이용 방법·예약 여부는 추후 SMG STORE 공식 계정 공지 예정',
    hours: null, hours_info: '운영 시간은 추후 공지 · 현대백화점 휴점일에는 운영하지 않습니다',
    description: [
      '「오란고교 사교클럽」 콜라보 카페가 현대백화점 신촌점 U-PLEX 지하 2층 SMG CAFE(구 OH!MAKE)에서 열립니다. 기간은 10월 2일(금)부터 11월 30일(월)까지이며, 전기와 후기로 나누어 진행됩니다.',
      '현재는 공식 COMING SOON 티저만 공개되었습니다. 전기·후기 구분 날짜, 메뉴와 가격, 특전, MD, 예약 방법은 SMG STORE 공식 계정(@smgstore_kr)에서 추후 안내할 예정입니다.',
    ].join('\n\n'),
    cover_url: cover.url, ...place(epic7, '지하 2층 SMG CAFE (구 OH!MAKE)'),
    source_urls: ['https://www.instagram.com/p/DdiIYMQiUcp/', 'https://x.com/smgstore_kr/status/2101866766695911465'], ticket_urls: [],
  })
  record(status, saved)
}

// ---------- 유희왕 POP-UP STORE 2026 ----------
{
  const cover = await uploadEventImage(db, `${dir}/yugioh-dopamine/reel_cover_teaser.jpg`, { folder: 'covers', maxWidth: 1080, maxHeight: 1920 })
  const { saved, status } = await batch.saveEvent({
    tag_id: '3d64da18-2032-46a2-9a39-729f5d94c58d', type: 'popup', title: T.yugioh,
    start_date: '2026-10-15', end_date: '2026-10-21', reserve_start: null, reserve_end: null,
    entry_info: '입장 방식·예약 여부는 추후 공지 예정',
    hours: null, hours_info: '운영 시간은 추후 공지 · 아이파크몰 리빙파크 영업시간 참고',
    description: [
      'KONAMI와 대원미디어가 여는 「유희왕 오피셜 카드게임」 팝업스토어입니다. 10월 15일(목)부터 21일(수)까지 단 7일 동안 용산 아이파크몰 리빙파크 3층 도파민 스테이션에서 열립니다.',
      '현재는 공식 COMING SOON 티저만 공개되었습니다. 판매 굿즈, 현장 이벤트, 입장 방식은 유희왕 공식 계정과 대원미디어 공지를 통해 추후 안내될 예정입니다.',
    ].join('\n\n'),
    cover_url: cover.url, ...place(harry, '리빙파크 3층 도파민 스테이션'),
    source_urls: ['https://www.instagram.com/reel/DdaXtqDO7Id/', 'https://x.com/Yugioh_Korea/status/2100766758378369147'], ticket_urls: [],
  })
  record(status, saved)
}

// ---------- 롯데월드 × 이토준지 컬렉션 ----------
{
  const k = `${dir}/itojunji-lotteworld`
  const cover = await uploadEventImage(db, `${k}/key_visual_announce.jpg`, { folder: 'covers', maxWidth: 1200 })
  const food = async (file) => (await uploadEventImage(db, `${k}/${file}`, { folder: 'compact-official-events', maxWidth: 380 })).url
  const menu = [
    ['소이치 초코 선데 아이스크림 (매직트럭 밀키)', 'site_food_01_soichi_choco_sundae.png'],
    ['토미에의 분열 주사 에이드 (로티로리치즈빵카트)', 'site_food_02_tomie_split_injection_ade.png'],
    ['옆집 창문 퍼플 라떼 (캔디캐슬 스쿨스토어)', 'site_food_03_neighbor_window_purple_latte.png'],
    ['혈옥수 블러드 에이드 (캔디캐슬 스쿨스토어)', 'site_food_04_blood_ade.png'],
    ['후치의 화려한 런웨이 에이드 (로티로리치즈빵카트)', 'site_food_05_fuchi_runway_ade.png'],
    ['롯데월드 × 이토준지 컬렉션 쿠키세트 (모리스딜라이트)', 'site_food_06_cookie_set.png'],
  ]
  const goods = []
  for (const [name, file] of menu) goods.push({ name, kind: 'menu', price: null, image: await food(file) })
  const { saved, status } = await batch.saveEvent({
    tag_id: '8e67bb8d-b3d2-4f70-abf7-d0d4df4a2bfd', // 이토 준지
    type: 'official_event', title: T.ito,
    start_date: '2026-09-19', end_date: '2026-11-15', reserve_start: null, reserve_end: null,
    entry_info: '롯데월드 어드벤처 파크 내부 콘텐츠 · 파크 입장권으로 이용 (별도 무료 입장 안내 없음)',
    hours: null, hours_info: '롯데월드 어드벤처 운영시간에 따름\n「토미에 : 기묘한 만남」 퍼포먼스 매일 16:00·17:00·18:00·20:00 (매직캐슬 3층)',
    description: [
      '롯데월드 어드벤처가 공포 만화가 이토 준지의 작품 세계를 테마파크에 구현한 가을 시즌 협업입니다. 팝업스토어가 아니라 매직아일랜드와 매직캐슬 일대에 포토존·체험·공연·F&B·굿즈를 펼치는 파크 콘텐츠로, 9월 19일부터 11월 15일까지 진행됩니다.',
      '매직아일랜드 입구에는 「소이치의 뒤틀린 환영」, 메인 브릿지에는 장미로 꾸민 「토미에 미혹의 브릿지」가 들어서고, 매직캐슬 뒤편은 「이토준지 포토스트리트」가 됩니다. 매직캐슬 3층 「이토준지 호러캐슬」에서는 토미에의 방(화가), 소이치의 방, 달팽이 소녀의 방을 둘러볼 수 있고, 같은 곳에서 「토미에 : 기묘한 만남」 퍼포먼스가 매일 16:00·17:00·18:00·20:00에 열립니다(관객과 상호작용 없음).',
      '협업 F&B로 소이치 초코 선데 아이스크림, 토미에의 분열 주사 에이드, 옆집 창문 퍼플 라떼, 혈옥수 블러드 에이드, 후치의 화려한 런웨이 에이드, 쿠키세트를 파크 내 지정 매장에서 판매합니다. 굿즈(토미에 안대 후드 담요, 토미에·소이치 티셔츠·인형 키링·인형 파우치백, 토미에 참 스쿨백, 랜덤 사운드 키캡 키링)는 어드벤처 1층과 매직아일랜드에서 판매하며, 상품별 판매 일정이 다르고 조기 품절될 수 있습니다. 메뉴·굿즈 가격은 공식적으로 공개되지 않았습니다.',
      '같은 기간 롯데월드 자체 시즌 콘텐츠인 「기묘한 세계의 초대 미스터리 파티」와 Dark Fantasy Festival 퍼레이드도 진행되지만, 이는 이토 준지 협업과는 별개입니다.',
    ].join('\n\n'),
    cover_url: cover.url,
    place_id: null, place_name: '롯데월드 어드벤처', place_addr: '서울 송파구 올림픽로 240',
    place_lat: 37.5111158, place_lng: 127.098163, place_detail: '매직아일랜드·매직캐슬 일대 (호러캐슬: 매직캐슬 3층)',
    parking: true, parking_note: '롯데월드 주차장 이용 (유료)',
    source_urls: ['https://adventure.lotteworld.com/enjoy/festival/view', 'https://www.instagram.com/p/Dc94HRrCdUl/', 'https://www.instagram.com/reel/Ddf2Tucp4bn/'], ticket_urls: [],
  }, { shopLookup: {} })
  record(status, saved, await batch.addGoods(saved.id, goods))
}

console.log(JSON.stringify(out, null, 2))
