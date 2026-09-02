import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const terms = ['이누야샤', '주술회전', '폼폼푸린', 'TFT', '전략적 팀 전투', '귀멸의 칼날', '하이큐', '타몬 군', '아이프리']

for (const term of terms) {
  const { data, error } = await db.from('events')
    .select('id,title,start_date,end_date,place_name,place_detail,cover_url')
    .ilike('title', `%${term}%`)
    .order('start_date', { ascending: false })
  if (error) throw error
  console.log(`\n## ${term}`)
  console.log(JSON.stringify(data, null, 2))
}
