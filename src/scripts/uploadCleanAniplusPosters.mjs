// ===== legacy path import guard (2026-09-18) =====
// 이 스크립트는 event-goods 버킷의 고정 경로에 upsert:true 로 업로드한다.
// 2026-09-18 중복 정리(49세트 / 111멤버 -> 49객체, 58,811,816 B 회수)로 그 경로들이
// 삭제됐다. 그대로 재실행하면 지운 중복이 되살아나거나 기존 객체를 덮어쓴다.
// 업로드를 content-addressed 로 전환하기 전까지 기본 실행을 막는다.
// 스크립트는 기록으로 보존한다. 삭제하지 말 것.
if (process.env.ALLOW_LEGACY_PATH_IMPORT !== 'I-UNDERSTAND-THIS-RECREATES-DUPLICATES') {
  console.error('legacy path import disabled')
  console.error('  script : uploadCleanAniplusPosters.mjs')
  console.error('  reason : event-goods 고정 경로 upsert:true 업로드 - 2026-09-18 dedup 결과를 되돌린다')
  console.error('  unlock : $env:ALLOW_LEGACY_PATH_IMPORT="I-UNDERSTAND-THIS-RECREATES-DUPLICATES"')
  console.error('           해당 PowerShell 세션에서만 유효. setx 로 영구 설정하지 말 것.')
  process.exit(1)
}
// ===== /legacy path import guard =====
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const posters = [
  { key: 'water', title: '물가의 밤 The Animation × 애니플러스 콜라보 카페' },
  { key: 'oshi', title: '【최애의 아이】 3기 × 애니플러스 콜라보 카페' },
  { key: 'uma', title: '우마무스메 프리티 더비 × 애니플러스 콜라보 카페' },
]

const output = []
for (const poster of posters) {
  const path = `tmp-aniplus-posters/${poster.key}-clean.png`
  const storagePath = `covers/aniplus-${poster.key}-2026-clean.png`
  const bytes = await readFile(path)
  const upload = await db.storage.from('event-goods').upload(storagePath, bytes, {
    contentType: 'image/png',
    cacheControl: '3600',
    upsert: true,
  })
  if (upload.error) throw upload.error
  const { data } = db.storage.from('event-goods').getPublicUrl(storagePath)
  const update = await db.from('events')
    .update({ cover_url: data.publicUrl, updated_at: new Date().toISOString() })
    .ilike('title', `${poster.title} (%)`)
    .select('id,title,cover_url')
  if (update.error) throw update.error
  output.push(...update.data)
}

if (output.length !== 6) throw new Error(`Expected 6 updated events, got ${output.length}`)
console.log(JSON.stringify(output, null, 2))
