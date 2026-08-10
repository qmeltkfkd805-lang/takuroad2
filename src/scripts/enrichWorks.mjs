import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..', '..')
const outputDir = resolve(here, 'work-enrichment-output')
const apply = process.argv.includes('--apply')

nextEnv.loadEnvConfig(projectRoot)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase server environment variables are missing')

const supabase = createClient(url, key, { auth: { persistSession: false } })

const GENRE_MAP = new Map([
  ['Action', '\uC561\uC158'], ['Adventure', '\uBAA8\uD5D8'], ['Comedy', '\uCF54\uBBF8\uB514'],
  ['Drama', '\uB4DC\uB77C\uB9C8'], ['Fantasy', '\uD310\uD0C0\uC9C0'], ['Horror', '\uACF5\uD3EC'],
  ['Mahou Shoujo', '\uB9C8\uBC95\uC18C\uB140'], ['Mecha', '\uB85C\uBD07/\uBA54\uCE74'], ['Music', '\uC74C\uC545'],
  ['Mystery', '\uCD94\uB9AC'], ['Psychological', '\uC2A4\uB9B4\uB7EC'], ['Romance', '\uB85C\uB9E8\uC2A4'],
  ['Sci-Fi', 'SF'], ['Slice of Life', '\uC77C\uC0C1'], ['Sports', '\uC2A4\uD3EC\uCE20'],
  ['Thriller', '\uC2A4\uB9B4\uB7EC'],
])

const BROAD_IP_SLUGS = new Set([
  'animal-crossing', 'azur-lane', 'barbapapa', 'chiikawa', 'cogimyun', 'devil-may-cry', 'dragon-ball', 'dragon-quest',
  'ensemble-stars', 'gundam', 'hello-kitty', 'hololive', 'kancolle', 'lilo-and-stitch',
  'girls-frontline', 'jewelpet', 'magic-the-gathering', 'maplestory', 'marumofubiyori', 'monster-strike', 'nijisanji', 'onimusha',
  'pokemon', 'precure', 'rilakkuma', 'sailor-moon', 'sonic-the-hedgehog',
  'street-fighter', 'tales-of', 'tamagotchi', 'transformers', 'ultraman', 'wish-me-mell', 'yo-kai-watch',
])
const normalize = (value) => String(value ?? '')
  .normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '')

const empty = (value) => value == null || value === '' || (Array.isArray(value) && value.length === 0)
const unique = (values) => [...new Set(values.filter(Boolean))]

function queryFor(work) {
  return (work.slug || work.name).replace(/-/g, ' ')
}

function chooseMatch(work, candidates) {
  if (BROAD_IP_SLUGS.has(String(work.slug).toLowerCase())) return null
  const target = normalize(work.slug)
  const exact = candidates.filter((media) => [media.title?.english, media.title?.romaji]
    .some((title) => normalize(title) === target))
  return exact.length === 1 ? exact[0] : null
}

function buildPatch(work, media) {
  const patch = {}
  const mappedGenres = unique((media.genres ?? []).map((genre) => GENRE_MAP.get(genre)))
  const englishName = media.title?.english || media.title?.romaji || null
  const aliases = unique([
    media.title?.romaji,
    media.title?.native,
    ...(media.synonyms ?? []),
  ]).filter((alias) => alias !== englishName && alias !== work.name).slice(0, 8)

  if (empty(work.english_name) && englishName) patch.english_name = englishName.slice(0, 100)
  if (empty(work.genres) && mappedGenres.length) patch.genres = mappedGenres
  if (empty(work.aliases) && aliases.length) patch.aliases = aliases

  if (empty(work.description) && mappedGenres.length) {
    const year = media.startDate?.year ? `${media.startDate.year}\uB144\uC5D0 \uACF5\uAC1C\uB41C ` : ''
    const format = media.format === 'MOVIE' ? '\uADF9\uC7A5\uD310 \uC560\uB2C8\uBA54\uC774\uC158' : '\uC560\uB2C8\uBA54\uC774\uC158'
    patch.description = `${work.name}: ${year}${mappedGenres.join('\u00B7')} \uC7A5\uB974\uC758 ${format} \uC791\uD488.`.slice(0, 80)
  }

  return patch
}

async function fetchAniListBatch(works) {
  const variables = {}
  const fields = works.map((work, index) => {
    variables[`q${index}`] = queryFor(work)
    return `q${index}: Page(page: 1, perPage: 10) { media(search: $q${index}, type: ANIME) { id title { romaji english native } synonyms genres format startDate { year } } }`
  }).join('\n')
  const declarations = works.map((_, index) => `$q${index}: String`).join(', ')
  let response
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: `query (${declarations}) { ${fields} }`, variables }),
    })
    if (response.status !== 429) break
    const retrySeconds = Number(response.headers.get('retry-after')) || 10
    await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(retrySeconds, 30) * 1000))
  }
  if (!response?.ok) throw new Error(`AniList request failed: ${response?.status}`)
  const json = await response.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return works.map((_, index) => json.data[`q${index}`]?.media ?? [])
}

async function main() {
  const { data: works, error } = await supabase.from('tags').select('*').order('name')
  if (error) throw error
  if (works.length !== 339) throw new Error(`Safety stop: expected 339 works, found ${works.length}`)

  await mkdir(outputDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await writeFile(resolve(outputDir, `backup-${stamp}.json`), JSON.stringify(works, null, 2), 'utf8')

  const report = []
  for (let start = 0; start < works.length; start += 15) {
    const batch = works.slice(start, start + 15)
    const results = await fetchAniListBatch(batch)
    batch.forEach((work, index) => {
      const media = chooseMatch(work, results[index])
      const patch = media ? buildPatch(work, media) : {}
      report.push({ id: work.id, slug: work.slug, name: work.name, matchedAniListId: media?.id ?? null, patch })
    })
  }

  const changes = report.filter((item) => Object.keys(item.patch).length > 0)
  await writeFile(resolve(outputDir, `dry-run-${stamp}.json`), JSON.stringify({ apply, total: works.length, changes }, null, 2), 'utf8')

  if (apply) {
    for (const item of changes) {
      const { data: current, error: readError } = await supabase.from('tags').select('*').eq('id', item.id).single()
      if (readError) throw readError
      const safePatch = Object.fromEntries(Object.entries(item.patch).filter(([field]) => empty(current[field])))
      if (!Object.keys(safePatch).length) continue
      const { error: updateError } = await supabase.from('tags').update(safePatch).eq('id', item.id)
      if (updateError) throw updateError
    }
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', total: works.length, matched: report.filter((x) => x.matchedAniListId).length, changed: changes.length, outputDir }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})





