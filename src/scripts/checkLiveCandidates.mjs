import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'

nextEnv.loadEnvConfig(resolve(import.meta.dirname, '..', '..'))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase server environment variables are missing')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const names = process.argv.slice(2)
const norm = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, '').trim()

const { data, error } = await supabase.from('tags').select('name, english_name, aliases, slug')
if (error) throw error
const result = names.map((candidate) => {
  const key = norm(candidate)
  const matches = data.filter((row) => [row.name, row.english_name, ...(row.aliases ?? [])].some((value) => norm(value) === key))
  return { candidate, matches: matches.map(({ name, slug }) => ({ name, slug })) }
})
console.log(JSON.stringify({ databaseRows: data.length, result }, null, 2))
