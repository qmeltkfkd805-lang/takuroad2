import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const terms = ['최애의 아이', 'Helluva Boss', '헬러바', '나가노마켓', '드래곤볼 히어로즈', 'K리그', '산리오']
for (const term of terms) {
  const result = await db.from('events').select('id,title,start_date,end_date,place_name,place_detail,cover_url').ilike('title', `%${term}%`).order('start_date', { ascending: false })
  if (result.error) throw result.error
  console.log(`\n## ${term}\n${JSON.stringify(result.data, null, 2)}`)
}
