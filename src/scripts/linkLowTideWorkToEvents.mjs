import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
nextEnv.loadEnvConfig(resolve(here, '..', '..'))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const apply = process.argv.includes('--apply')
const eventPrefix = '물가의 밤 The Animation × 애니플러스 콜라보 카페'
const work = {
  name: '물가의 밤',
  slug: 'low-tide-in-twilight',
  english_name: 'Low Tide in Twilight',
  aliases: ['물밤'],
  ip_type: '웹툰',
  description: '삶의 끝에 몰린 김의현을 여태주가 구해 내며 시작되는 두 사람의 위태롭고 격정적인 BL 웹툰이다.',
  genres: ['BL', '드라마'],
  keywords: [],
  cover_url: null,
  official_url: 'https://www.bomtoon.com/detail/night_of_W',
  links: [{ label: '공식 사이트', url: 'https://www.bomtoon.com/detail/night_of_W' }],
  created_by: null,
}

const { data: existing, error: existingError } = await db.from('tags').select('*').or(`name.eq.${work.name},slug.eq.${work.slug},english_name.eq.${work.english_name}`)
if (existingError) throw existingError
const { data: events, error: eventsError } = await db.from('events').select('id,title,tag_id,updated_at').ilike('title', `${eventPrefix}%`).order('title')
if (eventsError) throw eventsError
if (existing.length) throw new Error(`Safety stop: matching work already exists (${existing.map((row) => row.name).join(', ')})`)
if (events.length !== 2) throw new Error(`Safety stop: expected 2 matching events, got ${events.length}`)
if (events.some((event) => event.tag_id)) throw new Error('Safety stop: at least one matching event is already connected to a work')

const outputDir = resolve(here, 'work-enrichment-output')
await mkdir(outputDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = resolve(outputDir, `pre-low-tide-work-link-${stamp}.json`)
await writeFile(backupPath, JSON.stringify({ existing, events }, null, 2), 'utf8')

if (!apply) {
  console.log(JSON.stringify({ mode: 'dry-run', work, matchingEvents: events, backupPath }, null, 2))
  process.exit(0)
}

const { data: inserted, error: insertError } = await db.from('tags').insert(work).select('*').single()
if (insertError) throw insertError
const eventIds = events.map((event) => event.id)
const { data: updated, error: updateError } = await db.from('events').update({ tag_id: inserted.id, updated_at: new Date().toISOString() }).in('id', eventIds).select('id,title,tag_id')
if (updateError) throw updateError
if (updated.length !== 2 || updated.some((event) => event.tag_id !== inserted.id)) throw new Error('Post-check failed while linking events')

const { data: verifiedWork, error: workError } = await db.from('tags').select('*').eq('id', inserted.id).single()
if (workError) throw workError
const reportPath = resolve(outputDir, `low-tide-work-link-${stamp}.json`)
await writeFile(reportPath, JSON.stringify({ work: verifiedWork, events: updated, backupPath }, null, 2), 'utf8')
console.log(JSON.stringify({ mode: 'apply', workId: inserted.id, workSlug: inserted.slug, linkedEvents: updated.length, backupPath, reportPath }, null, 2))
