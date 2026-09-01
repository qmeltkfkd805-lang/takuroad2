import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const title = 'MAPLESTORY in LOTTEWORLD BUSAN'
const officialUrl = 'https://lotteworldrecruit.tistory.com/entry/%EB%A9%94%EC%9D%B4%ED%94%8C-%EC%9A%A9%EC%82%AC%EC%97%AC-%EB%B6%80%EC%82%B0%EC%9C%BC%EB%A1%9C-%EB%AA%A8%EC%97%AC%EB%9D%BC-%EB%A1%AF%EB%8D%B0%EC%9B%94%EB%93%9C-%EB%B6%80%EC%82%B0-%EA%B0%80%EC%9D%84-%EC%8B%9C%EC%A6%8C-%EC%B6%95%EC%A0%9C-MAPLESTORY-in-LOTTEWORLD-BUSAN-%EC%98%A4%ED%94%88'

const old = await db.from('events').select('*').eq('title', title).eq('start_date', '2026-08-29').maybeSingle()
if (old.error) throw old.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-maplestory-busan-${Date.now()}.json`, JSON.stringify(old.data, null, 2))

let place = await db.from('places').select('*').eq('name', '롯데월드 어드벤처 부산').maybeSingle()
if (place.error) throw place.error
if (!place.data) {
  const kakao = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('롯데월드 어드벤처 부산')}`, {
    headers: { Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_KEY}` },
  })
  if (!kakao.ok) throw new Error(`Kakao place search failed ${kakao.status}`)
  const docs = (await kakao.json()).documents
  const found = docs.find((row) => row.place_name.includes('롯데월드') && row.place_name.includes('부산'))
  if (!found) throw new Error('롯데월드 어드벤처 부산 장소 검색 결과를 찾지 못했습니다.')
  place = await db.from('places').insert({
    slug: 'lotte-world-adventure-busan',
    name: '롯데월드 어드벤처 부산',
    place_type: 'CULTURE_SPACE',
    addr: found.road_address_name || found.address_name,
    region: '부산',
    district: '기장군',
    lat: Number(found.y),
    lng: Number(found.x),
    kakao_place_id: found.id,
    category_name: found.category_name,
    parking: true,
    parking_note: '주차 가능(유료)\n파크 이용객 모바일 정산 일 최대 3,500원\n사전정산기 일 최대 4,000원\n출구 정산 일 최대 6,000원',
  }).select('*').single()
  if (place.error) throw place.error
}

const tag = await db.from('tags').select('id,name').eq('name', '메이플스토리').single()
if (tag.error) throw tag.error

const poster = await readFile('tmp/maplestory-busan-official.jpg')
const storagePath = 'covers/2026/maplestory-in-lotteworld-busan-main.jpg'
const upload = await db.storage.from('event-goods').upload(storagePath, poster, { contentType: 'image/jpeg', upsert: true })
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '10:00', close: '19:00' }]))
const event = {
  tag_id: tag.data.id,
  type: 'popup',
  title,
  start_date: '2026-08-29',
  end_date: '2026-11-22',
  reserve_start: null,
  reserve_end: null,
  entry_info: '종합이용권 구매 후 입장\n현장 구매 가능',
  description: '롯데월드 어드벤처 부산의 매직포레스트가 메이플스토리 세계관으로 꾸며지는 공식 가을 시즌 축제입니다. 포토존과 캐릭터 만들기, 모바일 스탬프 랠리, 퍼레이드와 핑크빈 포토타임을 함께 즐길 수 있습니다.\n\n전용 굿즈는 로리스 엠포리움과 가든스테이지 팝업스토어에서 판매합니다. 퍼레이드는 12:30과 16:00에 진행되며 12:30 공연은 화요일에 휴연합니다. 핑크빈 포토타임은 토킹트리 앞에서 11:00과 17:00에 진행됩니다.',
  cover_url: coverUrl,
  place_id: place.data.id,
  place_name: place.data.name,
  place_addr: place.data.addr,
  place_lat: place.data.lat,
  place_lng: place.data.lng,
  place_detail: '매직포레스트 전역·가든스테이지·로리스 엠포리움',
  parking: true,
  parking_note: place.data.parking_note,
  hours,
  hours_info: '매일 10:00~19:00\n파크 운영 일정에 따라 폐장 시각 변동 가능',
  source_urls: [officialUrl, 'https://adventurebusan.lotteworld.com/'],
  ticket_urls: [{ url: 'https://menu.payco.kr/menu/ticket?shopId=S220106357', label: '종합이용권 예매하기' }],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

const result = old.data
  ? await db.from('events').update(event).eq('id', old.data.id).select('*').single()
  : await db.from('events').insert(event).select('*').single()
if (result.error) throw result.error
console.log(JSON.stringify({ status: old.data ? 'UPDATE' : 'INSERT', event: result.data, place: place.data }, null, 2))
