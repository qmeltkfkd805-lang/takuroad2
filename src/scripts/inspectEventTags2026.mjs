import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const result = await db.from('tags').select('id,name,slug').order('name').limit(200)
if (result.error) throw result.error
console.log(JSON.stringify(result.data, null, 2))
