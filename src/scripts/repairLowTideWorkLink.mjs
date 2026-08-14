import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
nextEnv.loadEnvConfig(resolve(here, '..', '..'))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const workId = '45099d3a-435b-4940-9fff-15546e0a58fd'
const eventIds = ['6b5856e7-8b7c-4f0a-b8ae-a78c752ecba9', 'd7af2161-436f-448d-b922-8bcd900c14ad']
const patch = {
  name: '물가의 밤',
  slug: 'low-tide-in-twilight',
  english_name: 'Low Tide in Twilight',
  aliases: ['물밤'],
  ip_type: '웹툰,애니',
  description: '삶의 끝에 몰린 김의현을 여태주가 구해 내며 시작되는 두 사람의 위태롭고 격정적인 BL 웹툰이다.',
  genres: ['BL', '드라마'],
  official_url: 'https://www.bomtoon.com/detail/night_of_W',
  links: [{ label: '공식 사이트', url: 'https://www.bomtoon.com/detail/night_of_W' }],
}

const { data: beforeWork, error: workError } = await db.from('tags').select('*').eq('id', workId).single()
if (workError) throw workError
const { data: beforeEvents, error: eventsError } = await db.from('events').select('*').in('id', eventIds).order('id')
if (eventsError) throw eventsError
if (beforeWork.slug !== patch.slug) throw new Error(`Safety stop: unexpected work slug ${beforeWork.slug}`)
if (beforeEvents.length !== 2 || beforeEvents.some((event) => event.tag_id !== workId)) throw new Error('Safety stop: events are not linked to the expected work')

const outputDir = resolve(here, 'work-enrichment-output')
await mkdir(outputDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = resolve(outputDir, `pre-low-tide-repair-${stamp}.json`)
await writeFile(backupPath, JSON.stringify({ work: beforeWork, events: beforeEvents }, null, 2), 'utf8')

const { data: work, error: updateError } = await db.from('tags').update(patch).eq('id', workId).select('*').single()
if (updateError) throw updateError
const { data: events, error: verifyError } = await db.from('events').select('id,title,tag_id').in('id', eventIds).order('id')
if (verifyError) throw verifyError
if (events.length !== 2 || events.some((event) => event.tag_id !== work.id)) throw new Error('Post-check failed: event link changed')
for (const [key, value] of Object.entries(patch)) {
  if (JSON.stringify(work[key]) !== JSON.stringify(value)) throw new Error(`Post-check failed: ${key}`)
}
const reportPath = resolve(outputDir, `low-tide-repair-${stamp}.json`)
await writeFile(reportPath, JSON.stringify({ work, events, backupPath }, null, 2), 'utf8')
console.log(JSON.stringify({ repairedWork: work.slug, workId: work.id, linkedEvents: events.length, backupPath, reportPath }, null, 2))
