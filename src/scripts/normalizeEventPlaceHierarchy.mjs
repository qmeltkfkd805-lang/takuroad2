import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const directParentByChildId = new Map([
  ['b467aaa6-a278-4498-9faa-7ee848631247', 'samjung'],
  ['e59bb204-dd86-4559-af53-b7399fe2f01f', 'samjung'],
  ['95642a70-209b-4aee-9a2a-07e05822ce49', 'akHongdae'],
  ['74741954-aa3c-47bc-8330-d776a6f48f9f', 'lcTower'],
  ['34bcac46-9947-4c0d-b8ef-81420d2e2161', 'lcTower'],
  ['8b34eff2-2ac2-46aa-9d79-53bfc21eb84a', 'lcAnnex'],
  ['d56ed668-3eff-42a8-8565-66931230754b', 'starcity'],
  ['1a2065ca-3c50-406b-a261-62bfaa979c24', 'lotteWorldShopping'],
  ['6cb9a43e-56e9-401c-82d0-1e22617e9735', 'delight2'],
])

const addressOnlyIds = new Set([
  '72fbcd10-0333-41dc-8b39-3227eddbdfa5',
  'dbe4218c-43c3-4a7e-a358-5c4adff8d103',
  '09864612-dbb0-4535-b733-bb816112619c',
  'beed7502-047a-494b-b6fd-d05e400246c5',
  'b0e0a581-2995-44bc-81f0-cf6d8aaaef15',
  '9fc2b81c-969d-46a9-979a-16d3ec9e5251',
  '1eda63a0-6555-4b17-b83f-5ae4244bbc8e',
  'e2b436de-4cb8-4303-b937-2e1fb766903b',
  'f81295ed-e859-481a-a245-0aa2f0443de3',
  'b408644f-01f0-44b9-8c0e-7effce7fa621',
  '9ad1908e-67e8-427b-9c13-0cf6859d6864',
])

const parentDefinitions = {
  samjung: { slug: 'samjung-tower', name: '삼정타워', place_type: 'SHOPPING_MALL', addr: '부산 부산진구 중앙대로 672', region: '부산', district: '부산진구', lat: 35.1530135123952, lng: 129.059606833427, kakao_place_id: '974194707', category_name: '가정,생활 > 복합쇼핑몰' },
  akHongdae: { slug: 'ak-plaza-hongdae', name: 'AK플라자 홍대', place_type: 'DEPARTMENT_STORE', addr: '서울 마포구 양화로 188', region: '서울', district: '마포구', lat: 37.5578085490102, lng: 126.926407838298, kakao_place_id: '1156421273', category_name: '가정,생활 > 백화점 > AK플라자' },
  lcTower: { slug: 'lc-tower-hongdae', name: 'LC타워', place_type: 'SHOPPING_MALL', addr: '서울 마포구 양화로 186', region: '서울', district: '마포구', lat: 37.5576667697525, lng: 126.925891892022, kakao_place_id: '1448728691', category_name: '부동산 > 빌딩' },
  lcAnnex: { slug: 'lc-tower-annex-hongdae', name: 'LC타워 별관', place_type: 'SHOPPING_MALL', addr: '서울 마포구 양화로 178-5', region: '서울', district: '마포구', lat: 37.5576971100367, lng: 126.925425573819, kakao_place_id: '1906948043', category_name: '부동산 > 빌딩' },
  starcity: { slug: 'starcity-mall-konkuk', name: '스타시티몰', place_type: 'SHOPPING_MALL', addr: '서울 광진구 아차산로 272', region: '서울', district: '광진구', lat: 37.5387990752117, lng: 127.072469149139, kakao_place_id: '12553066', category_name: '가정,생활 > 상가,아케이드' },
  lotteWorldShopping: { slug: 'lotte-world-shopping-mall-jamsil', name: '롯데월드 쇼핑몰', place_type: 'SHOPPING_MALL', addr: '서울 송파구 올림픽로 240', region: '서울', district: '송파구', lat: 37.5116711641753, lng: 127.09816575087, kakao_place_id: null, category_name: '가정,생활 > 복합쇼핑몰', parking: true, parking_note: '주차 가능(유료)\n최초 30분 1,000원, 이후 10분당 1,000원\n5만원 이상 구매 시 1시간, 10만원 이상 2시간, 15만원 이상 3시간 무료\n무료 주차는 최대 3시간' },
  delight2: { slug: 'delight-square-2', name: '딜라이트스퀘어 2차', place_type: 'SHOPPING_MALL', addr: '서울 마포구 월드컵로3길 14', region: '서울', district: '마포구', lat: 37.5509991217329, lng: 126.912350188555, kakao_place_id: '274928071', category_name: '가정,생활 > 상가,아케이드' },
}

async function ensureParent(definition) {
  let query = db.from('places').select('*')
  query = definition.kakao_place_id
    ? query.eq('kakao_place_id', definition.kakao_place_id)
    : query.eq('name', definition.name).eq('addr', definition.addr)
  const existing = await query.maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data
  const inserted = await db.from('places').insert(definition).select('*').single()
  if (inserted.error) throw inserted.error
  return inserted.data
}

const childIds = [...new Set([...directParentByChildId.keys(), ...addressOnlyIds])]
const [placesResult, eventsResult] = await Promise.all([
  db.from('places').select('*').in('id', childIds),
  db.from('events').select('*').in('place_id', childIds),
])
if (placesResult.error) throw placesResult.error
if (eventsResult.error) throw eventsResult.error

await mkdir('scripts/backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backupPath = `scripts/backups/event-place-hierarchy-${stamp}.json`
await writeFile(backupPath, JSON.stringify({ places: placesResult.data, events: eventsResult.data }, null, 2), 'utf8')

const parents = {}
for (const [key, definition] of Object.entries(parentDefinitions)) parents[key] = await ensureParent(definition)

const updated = []
for (const event of eventsResult.data) {
  const parentKey = directParentByChildId.get(event.place_id)
  const fields = parentKey
    ? {
        place_id: parents[parentKey].id,
        place_name: parents[parentKey].name,
        place_addr: parents[parentKey].addr,
        place_lat: parents[parentKey].lat,
        place_lng: parents[parentKey].lng,
      }
    : { place_id: null }
  const result = await db.from('events').update(fields).eq('id', event.id).select('id,title,place_id,place_name,place_addr,place_detail').single()
  if (result.error) throw result.error
  updated.push(result.data)
}

const deleted = []
const retained = []
for (const place of placesResult.data) {
  const [eventRefs, shopRefs] = await Promise.all([
    db.from('events').select('id', { count: 'exact', head: true }).eq('place_id', place.id),
    db.from('shops').select('id', { count: 'exact', head: true }).eq('place_id', place.id),
  ])
  if (eventRefs.error) throw eventRefs.error
  if (shopRefs.error) throw shopRefs.error
  if ((eventRefs.count ?? 0) === 0 && (shopRefs.count ?? 0) === 0) {
    const result = await db.from('places').delete().eq('id', place.id)
    if (result.error) throw result.error
    deleted.push({ id: place.id, name: place.name })
  } else {
    retained.push({ id: place.id, name: place.name, eventRefs: eventRefs.count, shopRefs: shopRefs.count })
  }
}

console.log(JSON.stringify({ backupPath, parents: Object.fromEntries(Object.entries(parents).map(([key, value]) => [key, { id: value.id, name: value.name }])), updated, deleted, retained }, null, 2))
