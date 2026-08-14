import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
nextEnv.loadEnvConfig(resolve(here, '..', '..'))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: works, error: workError } = await db.from('tags').select('id,name,slug,english_name,aliases,ip_type,description,genres,official_url,links').or('name.eq.물가의 밤,slug.eq.low-tide-in-twilight,english_name.eq.Low Tide in Twilight')
if (workError) throw workError
const { data: events, error: eventError } = await db.from('events').select('id,title,tag_id').ilike('title', '물가의 밤 The Animation × 애니플러스 콜라보 카페%').order('title')
if (eventError) throw eventError
const ascii = JSON.stringify({ works, events }, null, 2).replace(/[^\x00-\x7F]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
console.log(ascii)
