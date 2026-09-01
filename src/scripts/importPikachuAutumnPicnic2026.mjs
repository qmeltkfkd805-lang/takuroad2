import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const tagId = '6200fb96-d722-4cbf-b09c-d5967f598ee7'
const officialNews = 'https://pokemongo.com/news/pikachu-autumn-picnic-korea-2026'
const officialPost = 'https://x.com/pokemonkrmkt/status/2092899929253621945'

const duplicates = await db.from('events').select('*').or('title.ilike.%피카츄의 가을 소풍%,title.ilike.%피카츄의 한국 나들이%')
if (duplicates.error) throw duplicates.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-pikachu-autumn-picnic-${Date.now()}.json`, JSON.stringify(duplicates.data, null, 2))

const posterPath = 'event-posters/pokemon-go-pikachu-autumn-picnic-2026-main.jpg'
const upload = await db.storage.from('event-goods').upload(
  posterPath,
  await readFile('scripts/work-menu-goods-images/pikachu-autumn-2026/official-main.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(posterPath).data.publicUrl

const common = {
  tag_id: tagId,
  type: 'official_event',
  reserve_start: null,
  reserve_end: null,
  entry_info: 'Pokémon GO 앱에서 무료 참여',
  cover_url: coverUrl,
  place_id: null,
  place_lat: null,
  place_lng: null,
  parking: null,
  parking_note: null,
  hours: null,
  source_urls: [officialNews, officialPost],
  ticket_urls: [],
  updated_by: editor,
  updated_at: new Date().toISOString(),
}

const rows = [
  {
    ...common,
    title: 'Pokémon GO 2026 피카츄의 가을 소풍',
    start_date: '2026-09-18',
    end_date: '2026-10-11',
    hours_info: '9월 18일 10:00 시작\n10월 11일 20:00 종료',
    place_name: '서울 하이커 그라운드 일대·인천국제공항 하이커 스테이션',
    place_addr: '서울 종로구·중구 일부 지역 및 인천국제공항',
    place_detail: '공식 이벤트 구역 내 지정 포켓스톱·체육관',
    description: '주황색 한복을 입은 피카츄가 처음 등장하는 Pokémon GO 지역 한정 이벤트입니다.\n지정 체육관 15곳의 레이드와 무료 시간제한 리서치, 필드리서치에 참여할 수 있습니다.\n\n한복 피카츄 레이드는 체육관마다 하루 1회만 참여할 수 있고 리모트 레이드패스는 사용할 수 없습니다.\n필드리서치는 포켓스톱마다 하루 1개만 받을 수 있습니다.\n시간제한 리서치는 종료 시각 전까지 과제를 완료하고 보상을 받아야 합니다.',
  },
  {
    ...common,
    title: 'Pokémon GO 2026 피카츄의 한국 나들이',
    start_date: '2026-09-24',
    end_date: '2026-09-26',
    hours_info: '9월 24일 10:00 시작\n9월 26일 20:00 종료',
    place_name: '대한민국 전역',
    place_addr: '대한민국 전역',
    place_detail: 'Pokémon GO 게임 내 이벤트',
    description: '주황색 한복을 입은 피카츄가 대한민국 전역의 별 1 레이드배틀과 무료 시간제한 리서치에 등장하는 Pokémon GO 이벤트입니다.\n포켓몬을 박사에게 보낼 때 받는 사탕과 레이드배틀에서 받는 별의모래가 2배로 적용됩니다.\n\n시간제한 리서치에서는 한복 피카츄와의 만남, 프리미엄 배틀패스, 별의모래 등의 보상을 받을 수 있습니다.\n리서치는 공식 안내에 표시된 만료 시각 전까지 완료하고 보상을 받아야 합니다.',
  },
]

const results = []
for (const row of rows) {
  const exact = duplicates.data.find((event) => event.title === row.title && event.start_date === row.start_date)
  const saved = exact
    ? await db.from('events').update(row).eq('id', exact.id).select('*').single()
    : await db.from('events').insert({ ...row, created_by: editor }).select('*').single()
  if (saved.error) throw saved.error
  results.push({ status: exact ? 'UPDATED' : 'INSERTED', id: saved.data.id, title: saved.data.title })
}

console.log(JSON.stringify({ results, coverUrl, pending: ['Pokémon GO 현장 이벤트 세부 일정'] }, null, 2))
