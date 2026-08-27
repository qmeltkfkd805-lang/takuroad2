import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
nextEnv.loadEnvConfig(resolve(here, '..', '..', '..'))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('tags')
    .select('name,english_name,aliases,slug,ip_type')
    .ilike('ip_type', '%애니%')
    .order('name')
    .range(from, from + 999)
  if (error) throw error
  rows.push(...data)
  if (data.length < 1000) break
}

console.log(JSON.stringify({ count: rows.length, rows }, null, 2))
