import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const rows = [
  { slug: 'ichiban-kuji', name: '이치방쿠지', english_name: 'Ichiban Kuji', ip_type: '캐릭터 굿즈', genres: ['애니', '만화', '게임'], description: '여러 작품의 캐릭터 상품을 경품으로 제공하는 반다이 스피리츠의 공식 캐릭터 쿠지 브랜드.', official_url: 'https://1kuji.com/', aliases: ['제일복권', '一番くじ'] },
  { slug: 'hazbin-hotel', name: '해즈빈 호텔', english_name: 'Hazbin Hotel', ip_type: '애니', genres: ['뮤지컬', '블랙코미디', '판타지'], description: '지옥의 구원을 목표로 한 호텔을 무대로 펼쳐지는 성인 뮤지컬 애니메이션.', official_url: 'https://hazbinhotel.com/', aliases: ['Hazbin Hotel'] },
]
const result = []
for (const row of rows) {
  const found = await db.from('tags').select('id,slug').eq('slug', row.slug).maybeSingle()
  if (found.error) throw found.error
  if (found.data) { result.push(found.data); continue }
  const inserted = await db.from('tags').insert(row).select('id,slug').single()
  if (inserted.error) throw inserted.error
  result.push(inserted.data)
}
console.log(JSON.stringify(result))
