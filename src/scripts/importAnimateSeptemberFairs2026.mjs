import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'
import { resolveSeriesKey } from './lib/seriesKey.mjs'

config({ path: '../.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const shopInfoUrl = 'https://www.animate-onlineshop.co.kr/main/html.php?htmid=service%2Fshopinfo.html'

const fairDefinitions = [
  {
    tag: {
      name: '제5인격', slug: 'identity-v', english_name: 'Identity V', ip_type: '게임', genres: ['게임'],
      description: 'NetEase Games가 서비스하는 비대칭 대전 게임입니다.',
      official_url: 'https://www.identityvgame.com/kr/',
    },
    title: '제5인격 겨울축제 페어 2026',
    start_date: '2026-08-29', end_date: '2026-09-13',
    branches: ['홍대점', '잠실롯데점', '부산점', '수원점'],
    officialUrl: 'https://www.animate-onlineshop.co.kr/board/view.php?bdId=event&sno=488',
    imageFile: 'identity-v-fair.jpg', imageSlug: 'identity-v-winter-festival-fair-2026',
    description: `게임 「제5인격」 관련 상품과 구매 특전을 만날 수 있는 애니메이트 공식 페어입니다.\n\n관련 상품을 구매하거나 예약한 금액 15,000원마다 구매 특전 일러스트 카드 1장을 랜덤으로 받을 수 있습니다.\n티켓과 쿠지는 특전 대상에서 제외되며, 특전은 준비 수량 소진 시 조기 종료됩니다.`,
    goodsName: '제5인격 겨울축제 페어 구매 특전 일러스트 카드',
  },
  {
    tag: {
      name: '학원 아이돌 마스터', slug: 'gakuen-idolmaster', english_name: 'Gakuen Idolmaster', ip_type: '게임', genres: ['게임', '아이돌'],
      description: '아이돌 후보생을 육성하는 아이돌 마스터 시리즈의 게임입니다.',
      official_url: 'https://gakuen.idolmaster-official.jp/',
    },
    title: '학원 아이돌 마스터 초성 문화제 페어 in animate',
    start_date: '2026-08-29', end_date: '2026-09-13',
    branches: ['홍대점', '잠실롯데점', '부산점'],
    officialUrl: 'https://www.animate-onlineshop.co.kr/board/view.php?bdId=event&sno=487',
    imageFile: 'gakumas-fair.jpg', imageSlug: 'gakuen-idolmaster-chosung-festival-fair-2026',
    description: `「학원 아이돌 마스터」 관련 상품과 구매 특전을 만날 수 있는 애니메이트 공식 페어입니다.\n\n관련 상품을 구매하거나 예약한 금액 15,000원마다 티켓풍 카드 13종 중 1장을 랜덤으로 받을 수 있습니다.\n티켓과 쿠지는 특전 대상에서 제외되며, 특전은 준비 수량 소진 시 조기 종료됩니다.`,
    goodsName: '학원 아이돌 마스터 초성 문화제 티켓풍 카드 특전',
  },
  {
    tag: {
      name: 'New PANTY & STOCKING with GARTERBELT', slug: 'new-panty-stocking-with-garterbelt',
      english_name: 'New PANTY & STOCKING with GARTERBELT', ip_type: '애니메이션', genres: ['애니메이션'],
      description: '천사 자매 팬티와 스타킹의 활약을 그린 애니메이션 작품입니다.',
      official_url: 'https://newpsg.com/',
    },
    title: 'New PANTY&STOCKING with GARTERBELT feat. ANIMATE 페어',
    start_date: '2026-09-05', end_date: '2026-09-20',
    branches: ['홍대점', '잠실롯데점', '부산점'],
    officialUrl: 'https://www.animate-onlineshop.co.kr/board/view.php?bdId=event&sno=489',
    imageFile: 'new-psg-fair.jpg', imageSlug: 'new-panty-stocking-animate-fair-2026',
    description: `「New PANTY&STOCKING with GARTERBELT」 관련 상품과 구매 특전을 만날 수 있는 애니메이트 공식 페어입니다.\n\n관련 상품을 구매하거나 예약한 금액 30,000원마다 플라스틱 카드 11종 중 1장을 랜덤으로 받을 수 있습니다.\n티켓과 쿠지는 특전 대상에서 제외되며, 특전은 준비 수량 소진 시 조기 종료됩니다.`,
    goodsName: 'New PANTY&STOCKING 플라스틱 카드 구매 특전',
  },
]

const templateResult = await db.from('events').select('*')
  .ilike('title', 'Re:제로부터 시작하는 이세계 생활 4th season FAIR in animate%')
if (templateResult.error) throw templateResult.error
const templates = new Map(templateResult.data.map((row) => {
  const suffix = row.title.match(/\(([^)]+점)\)$/)?.[1]
  return [suffix, row]
}))
for (const branch of ['홍대점', '잠실롯데점', '부산점', '수원점']) {
  if (!templates.has(branch)) throw new Error(`지점 템플릿을 찾지 못했습니다: ${branch}`)
}

const titleFilters = fairDefinitions.map((fair) => `title.ilike.${fair.title}%`).join(',')
const duplicateResult = await db.from('events').select('*').or(titleFilters)
if (duplicateResult.error) throw duplicateResult.error

await mkdir('scripts/event-backups', { recursive: true })
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await writeFile(
  `scripts/event-backups/before-animate-september-fairs-${stamp}.json`,
  JSON.stringify({ events: duplicateResult.data }, null, 2),
)

const tagIds = new Map()
for (const fair of fairDefinitions) {
  let tagResult = await db.from('tags').select('id').eq('slug', fair.tag.slug).maybeSingle()
  if (tagResult.error) throw tagResult.error
  if (!tagResult.data) {
    tagResult = await db.from('tags').insert({ ...fair.tag, created_by: editor }).select('id').single()
    if (tagResult.error) throw tagResult.error
  }
  tagIds.set(fair.tag.slug, tagResult.data.id)
}

const output = []
for (const fair of fairDefinitions) {
  const image = await readFile(`scripts/work-animate-sep-fairs/${fair.imageFile}`)
  const coverPath = `event-posters/${fair.imageSlug}.jpg`
  const coverUpload = await db.storage.from('event-goods').upload(coverPath, image, {
    contentType: 'image/jpeg', upsert: true,
  })
  if (coverUpload.error) throw coverUpload.error
  const coverUrl = db.storage.from('event-goods').getPublicUrl(coverPath).data.publicUrl

  for (const branch of fair.branches) {
    const template = templates.get(branch)
    const title = `${fair.title} (${branch})`
    const event = {
      tag_id: tagIds.get(fair.tag.slug), type: 'popup', title,
      start_date: fair.start_date, end_date: fair.end_date,
      reserve_start: null, reserve_end: null,
      entry_info: '현장 선착순 입장', description: fair.description, cover_url: coverUrl,
      place_id: template.place_id, place_name: template.place_name, place_addr: template.place_addr,
      place_lat: template.place_lat, place_lng: template.place_lng, place_detail: template.place_detail,
      parking: template.parking, parking_note: template.parking_note,
      hours: template.hours, hours_info: template.hours_info,
      source_urls: [fair.officialUrl, shopInfoUrl], ticket_urls: [],
      updated_by: editor, updated_at: new Date().toISOString(),
    }

    event.shop_id = await findShopId(db, {
      placeId: event.place_id,
      addr: event.place_addr,
      nameHint: event.place_detail || event.place_name,
    })
    event.series_key = await resolveSeriesKey(db, {
      title: event.title,
      startDate: event.start_date,
      endDate: event.end_date,
    })

    const existing = duplicateResult.data.find((row) => row.title === title && row.start_date === fair.start_date && row.end_date === fair.end_date)
    const saved = existing
      ? await db.from('events').update(event).eq('id', existing.id).select('*').single()
      : await db.from('events').insert({ ...event, created_by: editor }).select('*').single()
    if (saved.error) throw saved.error

    const beforeGoods = await db.from('event_goods').select('*').eq('event_id', saved.data.id)
    if (beforeGoods.error) throw beforeGoods.error
    await writeFile(
      `scripts/event-goods-backups/before-${fair.imageSlug}-${branch}-${stamp}.json`,
      JSON.stringify(beforeGoods.data, null, 2),
    )

    const duplicateGoods = await db.from('event_goods').select('id')
      .eq('event_id', saved.data.id).eq('name', fair.goodsName).eq('is_deleted', false).maybeSingle()
    if (duplicateGoods.error) throw duplicateGoods.error
    let goodsStatus = 'SKIPPED_DUPLICATE'
    if (!duplicateGoods.data) {
      const goodsPath = `${saved.data.id}/official-${fair.imageSlug}-benefit.jpg`
      const goodsUpload = await db.storage.from('event-goods').upload(goodsPath, image, {
        contentType: 'image/jpeg', upsert: true,
      })
      if (goodsUpload.error) throw goodsUpload.error
      const imageUrl = db.storage.from('event-goods').getPublicUrl(goodsPath).data.publicUrl
      const goodsInsert = await db.from('event_goods').insert({
        event_id: saved.data.id, name: fair.goodsName, kind: 'goods', price: null,
        image_url: imageUrl, created_by: editor, updated_by: editor,
      })
      if (goodsInsert.error) throw goodsInsert.error
      goodsStatus = 'INSERTED'
    }

    output.push({
      status: existing ? 'UPDATED' : 'INSERTED', id: saved.data.id, title: saved.data.title,
      shop_id: saved.data.shop_id, series_key: saved.data.series_key, goodsStatus,
    })
  }
}

console.log(JSON.stringify(output, null, 2))
