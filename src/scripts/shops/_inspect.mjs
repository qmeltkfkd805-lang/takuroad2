import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const t = process.argv[2]
const r = await db.from(t).select('*', { count: 'exact' }).limit(Number(process.argv[3] ?? 1))
if (r.error) console.log(r.error)
console.log('count', r.count)
console.log(JSON.stringify(r.data, null, 1).slice(0, 6000))
