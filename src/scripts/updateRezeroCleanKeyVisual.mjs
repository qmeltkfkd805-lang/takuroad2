// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : updateRezeroCleanKeyVisual.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const eventIds = [
  '887a3cc3-2d88-4ef0-967f-8cc36b86cc5f',
  'e12cc7a5-99be-4e7b-8ed0-ad0a52fd6c09',
  'de622d7c-f7e8-489f-9411-e833d0d3bd81',
  'ebdc6eaa-e429-4311-b0ae-3fb26c0f61e0',
]
const sourceUrl = 'https://x.com/Rezero_official/status/2067252676136468753'

const before = await db.from('events').select('id,title,cover_url,source_urls').in('id', eventIds)
if (before.error) throw before.error
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-rezero-clean-keyvisual-${Date.now()}.json`, JSON.stringify(before.data, null, 2))

const storagePath = 'covers/2026/re-zero-4th-regain-clean-keyvisual.jpg'
const upload = await db.storage.from('event-goods').upload(
  storagePath,
  await readFile('scripts/work-event-covers/rezero-4th-regain-clean.jpg'),
  { contentType: 'image/jpeg', upsert: true },
)
if (upload.error) throw upload.error
const coverUrl = db.storage.from('event-goods').getPublicUrl(storagePath).data.publicUrl

const results = []
for (const event of before.data) {
  const saved = await db.from('events').update({
    cover_url: coverUrl,
    source_urls: [...new Set([...(event.source_urls ?? []), sourceUrl])],
    updated_by: editor,
    updated_at: new Date().toISOString(),
  }).eq('id', event.id).select('id,title,cover_url').single()
  if (saved.error) throw saved.error
  results.push(saved.data)
}

console.log(JSON.stringify({ coverUrl, updated: results }, null, 2))
