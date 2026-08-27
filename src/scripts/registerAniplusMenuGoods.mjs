import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editorId = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'
const imageDir = 'scripts/work-menu-goods-images'
const cdn = 'https://bc8azosk4j.ecn.cdn.ofs.kr/TShop/template/'

const sets = [
  {
    events: [
      'a4818efc-8352-44f5-ba67-4c7094fd9326',
      '779691e7-edcb-4f64-9fb0-d1670413f8aa',
    ],
    rows: [
      ['menu', '콜라보 카페 메뉴 안내', null, '112-0-detail_20260703112242_1783045362626_ae445bc7.png'],
      ['menu', '1~2주차 카페 특전 안내', null, '112-1-detail_20260629085139_1782690699771_aab49fb1.png'],
      ['menu', '1~2주차 스페셜 메뉴 안내', 25000, '112-2-detail_20260629085139_1782690699798_b74cfdcf.png'],
      ['goods', '2만원 이상 굿즈 구매 특전', null, '112-3-detail_20260629085145_1782690705134_2e31252a.png'],
      ['goods', '5만원 이상 굿즈 구매 특전', null, '112-4-detail_20260629085149_1782690709246_fca6a7a5.png'],
      ['goods', '공식 굿즈 목록', null, '112-5-detail_20260629085329_1782690809990_e995dca5.png'],
    ],
  },
  {
    events: [
      'fffe00a6-38ba-4602-aa34-e8a3fafb8949',
      'c289de21-064d-4963-aff4-819e36c5ce5c',
    ],
    rows: [
      ['menu', '콜라보 카페 메뉴 안내', null, '113-1-detail_20260728153121_1785220281665_024b2a52.png'],
      ['menu', '1~2주차 카페 특전 안내', null, '113-2-detail_20260728153121_1785220281683_307a76af.png'],
      ['menu', '1~2주차 스페셜 메뉴 안내', 24000, '113-3-detail_20260728153121_1785220281701_cb6dc70b.png'],
      ['goods', '굿즈 구매 특전 안내', null, '113-4-detail_20260728153121_1785220281721_3560988a.png'],
      ['goods', '공식 굿즈 목록', null, '113-5-detail_20260728153121_1785220281756_69db5861.png'],
    ],
  },
]

const eventIds = sets.flatMap(s => s.events)
const { data: before, error: beforeError } = await db.from('event_goods').select('*').in('event_id', eventIds)
if (beforeError) throw beforeError
await mkdir('scripts/event-goods-backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const backup = `scripts/event-goods-backups/before-aniplus-${stamp}.json`
await writeFile(backup, JSON.stringify(before, null, 2), 'utf8')

const results = []
for (const set of sets) {
  for (const eventId of set.events) {
    for (const [kind, name, price, filename] of set.rows) {
      const { data: duplicate, error: duplicateError } = await db
        .from('event_goods')
        .select('id')
        .eq('event_id', eventId)
        .eq('name', name)
        .eq('is_deleted', false)
        .maybeSingle()
      if (duplicateError) throw duplicateError
      if (duplicate) {
        results.push({ eventId, name, status: 'SKIPPED_DUPLICATE' })
        continue
      }

      const objectPath = `${eventId}/official-aniplus-${filename.replace(/^\d+-\d+-/, '')}`
      const image = await readFile(`${imageDir}/${filename}`)
      const { error: uploadError } = await db.storage.from('event-goods').upload(objectPath, image, {
        contentType: 'image/png',
        upsert: true,
      })
      if (uploadError) throw uploadError
      const { data: publicData } = db.storage.from('event-goods').getPublicUrl(objectPath)
      const { error: insertError } = await db.from('event_goods').insert({
        event_id: eventId,
        name,
        kind,
        price,
        image_url: publicData.publicUrl,
        created_by: editorId,
        updated_by: editorId,
      })
      if (insertError) throw insertError
      results.push({ eventId, name, kind, price, imageSource: `${cdn}${filename.replace(/^\d+-\d+-/, '')}`, status: 'INSERTED' })
    }
  }
}

console.log(JSON.stringify({ backup, inserted: results.filter(r => r.status === 'INSERTED').length, results }, null, 2))
