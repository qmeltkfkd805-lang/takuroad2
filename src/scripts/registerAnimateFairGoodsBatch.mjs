// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : registerAnimateFairGoodsBatch.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'

const groups = [
  {
    key: 'ouran', name: '공식 20주년 기념 상품 및 구매 특전 안내',
    image: 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/a2f4267f8352238e9b5682ee5bcc581d_145831.jpeg',
    eventIds: ['baa10131-eccc-44e8-9354-4c578b6f2300', 'bcb55cb5-4e0d-4a6a-96f2-e9c0e6a66bec', '0e2a2db6-15ea-4a57-b761-34ec69ff6974'],
  },
  {
    key: 'frieren', name: '공식 페어 상품 및 구매 특전 안내',
    image: 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/678900f5bc76e369cba94a06cd8f1d93_110052.jpeg',
    eventIds: ['963229d2-fb56-4dda-92b7-e98eba4c9ca5', '24c51f45-6eaf-463f-91f5-7fda7ab5ebbd', '2c2da745-890e-4644-a671-b5447a226df2'],
  },
  {
    key: 'apothecary', name: '공식 만우절 페어 상품 및 구매 특전 안내',
    image: 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/4c2a9c81f69e8e38248078e1a771ff27_180531.jpg',
    eventIds: ['fa8f897e-8bd6-4117-bc09-e03effeb51ef', '874b0fce-938d-4283-940b-b54e9c67c799'],
  },
  {
    key: 'rezero4', name: '공식 4th season 페어 상품 및 구매 특전 안내',
    image: 'https://cdn-pro-web-250-117.cdn-nhncommerce.com/animatete13_godomall_com/data/editor/board/event/f646e1ac7c01bee5572525a1dbc661c5_120627.jpeg',
    eventIds: ['ebdc6eaa-e429-4311-b0ae-3fb26c0f61e0', 'de622d7c-f7e8-489f-9411-e833d0d3bd81', '887a3cc3-2d88-4ef0-967f-8cc36b86cc5f', 'e12cc7a5-99be-4e7b-8ed0-ad0a52fd6c09'],
  },
]

const allIds = groups.flatMap((group) => group.eventIds)
const before = await db.from('event_goods').select('*').in('event_id', allIds)
if (before.error) throw before.error
await mkdir('scripts/event-goods-backups', { recursive: true })
await writeFile(`scripts/event-goods-backups/before-animate-fairs-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const results = []
for (const group of groups) {
  const response = await fetch(group.image)
  if (!response.ok) throw new Error(`${group.key} image download failed: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') || (group.image.endsWith('.jpg') ? 'image/jpeg' : 'image/jpeg')
  for (const eventId of group.eventIds) {
    const duplicate = await db.from('event_goods').select('id').eq('event_id', eventId).eq('name', group.name).eq('is_deleted', false).maybeSingle()
    if (duplicate.error) throw duplicate.error
    if (duplicate.data) {
      results.push({ eventId, name: group.name, status: 'SKIPPED_DUPLICATE' })
      continue
    }
    const objectPath = `${eventId}/official-${group.key}-goods.jpg`
    const upload = await db.storage.from('event-goods').upload(objectPath, bytes, { contentType, upsert: true })
    if (upload.error) throw upload.error
    const imageUrl = db.storage.from('event-goods').getPublicUrl(objectPath).data.publicUrl
    const inserted = await db.from('event_goods').insert({ event_id: eventId, name: group.name, kind: 'goods', price: null, image_url: imageUrl, created_by: editor, updated_by: editor })
    if (inserted.error) throw inserted.error
    results.push({ eventId, name: group.name, status: 'INSERTED' })
  }
}

console.log(JSON.stringify({ inserted: results.filter((row) => row.status === 'INSERTED').length, results }, null, 2))
