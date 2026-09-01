import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const sourceMain = 'https://x.com/dcc_comic/status/2090725602706022452'
const sourceGoods = 'https://x.com/dcc_comic/status/2089911691815653625'

const imageDefs = [
  ['cover', 'https://pbs.twimg.com/media/HQO1B_ta8AALisr.jpg?name=orig'],
  ['menu', 'https://pbs.twimg.com/media/HQO1CG_bIAACwSy.jpg?name=orig'],
  ['benefit', 'https://pbs.twimg.com/media/HQO1CHAbEAAvX5y.jpg?name=orig'],
  ['goods1', 'https://pbs.twimg.com/media/HQDYpPTaoAA_E2n.jpg?name=orig'],
  ['goods2', 'https://pbs.twimg.com/media/HQDYpPKawAAMmKu.jpg?name=orig'],
]
const urls = {}
for (const [key, url] of imageDefs) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${key} download failed: ${response.status}`)
  const path = `goods/2026/mermaid-lake-gratte-${key}.jpg`
  const upload = await db.storage.from('event-goods').upload(path, Buffer.from(await response.arrayBuffer()), { contentType: 'image/jpeg', upsert: true })
  if (upload.error) throw upload.error
  urls[key] = db.storage.from('event-goods').getPublicUrl(path).data.publicUrl
}

const beforeEvents = await db.from('events').select('*').ilike('title', '%내 호수에 가둔 인어%')
if (beforeEvents.error) throw beforeEvents.error
const beforeTag = await db.from('tags').select('*').eq('slug', 'mermaid-in-my-lake').maybeSingle()
if (beforeTag.error) throw beforeTag.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-mermaid-lake-gratte-${Date.now()}.json`, JSON.stringify({ events: beforeEvents.data, tag: beforeTag.data }, null, 2))

let tag = beforeTag.data
if (!tag) {
  const inserted = await db.from('tags').insert({
    name: '내 호수에 가둔 인어', slug: 'mermaid-in-my-lake', ip_type: '웹툰',
    genres: ['로맨스 판타지'], description: '알뽀비 작가의 로맨스 판타지 웹툰입니다.',
    twitter_url: 'https://x.com/rppobi_webtoon', created_by: editor,
  }).select('*').single()
  if (inserted.error) throw inserted.error
  tag = inserted.data
}

const templateQuery = await db.from('events').select('place_id,place_name,place_addr,place_lat,place_lng,place_detail,parking,parking_note,hours,hours_info').in('id', [
  'aa185e65-181f-4230-a336-7c085a60340a',
  '199cc2c8-371f-4c53-86b9-8d44010631d9',
])
if (templateQuery.error) throw templateQuery.error
const [hongdae, jamsil] = templateQuery.data

const branches = [
  { suffix: '홍대점', template: hongdae, source: 'https://x.com/animatecafe_kor' },
  { suffix: '잠실롯데점', template: jamsil, source: 'https://x.com/animatecafe_js' },
]
const results = []
for (const branch of branches) {
  const title = `내 호수에 가둔 인어 Gratte (${branch.suffix})`
  const payload = {
    tag_id: tag.id, type: 'collab_cafe', title,
    start_date: '2026-08-26', end_date: '2026-09-20', reserve_start: null, reserve_end: null,
    entry_info: '현장 선착순 입장',
    description: '웹툰 「내 호수에 가둔 인어」의 일러스트를 활용한 Gratte 행사입니다.\n\n그라떼와 아이스크림, 아이싱 쿠키를 판매하며 북케이스 쿠키 세트와 유상 특전, 공식 굿즈를 함께 만날 수 있습니다.',
    cover_url: urls.cover,
    ...branch.template,
    source_urls: [sourceMain, sourceGoods, branch.source], ticket_urls: [],
    updated_by: editor, updated_at: new Date().toISOString(),
  }
  const duplicate = await db.from('events').select('id').eq('title', title).eq('start_date', payload.start_date).maybeSingle()
  if (duplicate.error) throw duplicate.error
  const saved = duplicate.data
    ? await db.from('events').update(payload).eq('id', duplicate.data.id).select('*').single()
    : await db.from('events').insert({ ...payload, created_by: editor }).select('*').single()
  if (saved.error) throw saved.error

  const rows = [
    { name: '그라떼·아이스크림·아이싱 쿠키 메뉴 안내', kind: 'menu', image_url: urls.menu },
    { name: '북케이스 쿠키 세트·유상 특전 안내', kind: 'goods', image_url: urls.benefit },
    { name: '아크릴 카드·캔뱃지', kind: 'goods', image_url: urls.goods1 },
    { name: '명대사 엽서', kind: 'goods', image_url: urls.goods2 },
  ]
  let insertedGoods = 0
  for (const row of rows) {
    const exists = await db.from('event_goods').select('id').eq('event_id', saved.data.id).eq('name', row.name).eq('is_deleted', false).maybeSingle()
    if (exists.error) throw exists.error
    if (exists.data) continue
    const added = await db.from('event_goods').insert({ ...row, event_id: saved.data.id, price: null, created_by: editor, updated_by: editor })
    if (added.error) throw added.error
    insertedGoods += 1
  }
  results.push({ eventId: saved.data.id, title, status: duplicate.data ? 'UPDATED' : 'INSERTED', insertedGoods })
}

console.log(JSON.stringify({ uploaded: Object.keys(urls), results }, null, 2))
