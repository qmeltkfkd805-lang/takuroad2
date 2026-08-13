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
