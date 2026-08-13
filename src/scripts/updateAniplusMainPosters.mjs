import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const base = 'https://bc8azosk4j.ecn.cdn.ofs.kr/TShop/collabo/'
const updates = [
  {
    title: '물가의 밤 The Animation × 애니플러스 콜라보 카페',
    cover_url: base + 'square_20260608172900_1780907340840_77a617b8.png',
  },
  {
    title: '【최애의 아이】 3기 × 애니플러스 콜라보 카페',
    cover_url: base + 'square_20260629085019_1782690619584_e018741c.png',
  },
  {
    title: '우마무스메 프리티 더비 × 애니플러스 콜라보 카페',
    cover_url: base + 'square_20260728152921_1785220161801_21c5c479.png',
  },
]

const output = []
for (const update of updates) {
  const result = await db.from('events')
    .update({ cover_url: update.cover_url, updated_at: new Date().toISOString() })
    .ilike('title', `${update.title} (%)`)
    .select('id,title,cover_url')
  if (result.error) throw result.error
  output.push(...result.data)
}

if (output.length !== 6) throw new Error(`Expected 6 updated events, got ${output.length}`)
console.log(JSON.stringify(output, null, 2))
