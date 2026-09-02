import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
for (const term of ['팬텀 퍼레이드', '아덕페', '폼폼푸린의 와-앙만두', '머메이드 파티', '포켓몬']) {
  const result = await db.from('events').select('id,title,start_date,end_date,place_name,place_detail,cover_url')
    .ilike('title', `%${term}%`).order('start_date', { ascending: false })
  if (result.error) throw result.error
  console.log(`\n## ${term}\n${JSON.stringify(result.data, null, 2)}`)
}
