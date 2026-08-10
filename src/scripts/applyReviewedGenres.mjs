import { readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const reviewDir = resolve('scripts/work-description-review')
const allowed = new Set(['액션', '판타지', '학원', '일상', 'SF', '추리', '로맨스', 'BL', 'GL', '코미디', '스포츠', '음악', '호러', '드라마', '마법소녀', '소년물', '로봇/메카', '19', '고어'])
const genres = {
  '100-girlfriends': ['로맨스', '코미디', '학원'],
  '5toubun-no-hanayome': ['로맨스', '코미디', '학원', '드라마'],
  '86-eighty-six': ['액션', 'SF', '드라마', '로봇/메카'],
  a3: ['음악', '드라마'],
  'afk-journey': ['액션', '판타지'],
  air: ['로맨스', '판타지', '드라마'],
  'aogiri-high-school': ['일상', '코미디', '음악'],
  bt21: ['일상', '코미디'],
  charlotte: ['판타지', '학원', '드라마'],
  'd-gray-man': ['액션', '판타지', '호러', '소년물'],
  d4dj: ['음악', '학원', '드라마'],
  fate: ['액션', '판타지', '드라마'],
  'id-invaded': ['SF', '추리', '드라마'],
  kanon: ['로맨스', '판타지', '드라마'],
  'kamen-rider': ['액션', 'SF', '소년물'],
  'fullmetal-alchemist': ['액션', '판타지', '드라마', '소년물'],
  gundam: ['액션', 'SF', '드라마', '로봇/메카'],
  'girls-band-cry': ['음악', '드라마'],
  'girls-und-panzer': ['액션', '학원', '스포츠'],
  'black-desert-online': ['액션', '판타지'],
  'yowamushi-pedal': ['학원', '스포츠', '드라마', '소년물'],
  frozen: ['판타지', '음악', '드라마'],
  godzilla: ['액션', 'SF', '호러'],
  'winnie-the-pooh': ['일상', '코미디'],
  'kara-no-kyokai': ['액션', '판타지', '추리', '호러'],
  umineko: ['판타지', '추리', '호러', '고어'],
  'kaiju-no-8': ['액션', 'SF', '소년물'],
  'mysterious-disappearances': ['판타지', '추리', '호러'],
  'demon-slayer': ['액션', '판타지', '소년물'],
  'my-dress-up-darling': ['학원', '로맨스', '코미디'],
  'solo-leveling': ['액션', '판타지'],
  'my-hero-academia': ['액션', '학원', '소년물'],
  'the-dangers-in-my-heart': ['학원', '로맨스', '코미디'],
  'no-game-no-life': ['판타지', '코미디'],
  nisekoi: ['학원', '로맨스', '코미디'],
  'nier-automata': ['액션', 'SF', '드라마'],
  nijisanji: ['일상', '코미디', '음악'],
  'UFO-Baby': ['일상', 'SF', '코미디'],
  tamagotchi: ['일상', '코미디'],
  'diamond-no-ace': ['학원', '스포츠', '소년물'],
  'dark-souls': ['액션', '판타지', '호러'],
  'dr-stone': ['SF', '소년물'],
  dandadan: ['액션', '판타지', '로맨스', '코미디'],
  'darling-in-the-franxx': ['SF', '로맨스', '드라마', '로봇/메카'],
  'king-of-fighters': ['액션'],
  'dungeon-fighter': ['액션', '판타지'],
  danmachi: ['액션', '판타지', '로맨스'],
  'devil-may-cry': ['액션', '판타지', '호러'],
  'death-note': ['추리', '드라마', '호러'],
  'date-a-live': ['판타지', '학원', '로맨스', '코미디'],
  'touken-ranbu': ['액션', '판타지'],
  doraemon: ['일상', 'SF', '코미디'],
  dorohedoro: ['액션', '판타지', '호러', '고어'],
  'the-elusive-samurai': ['액션', '드라마', '소년물'],
  'tokyo-revengers': ['액션', 'SF', '드라마'],
  'animal-crossing': ['일상'],
  'touhou-project': ['액션', '판타지'],
  'donkey-kong': ['액션', '코미디'],
  'duel-masters': ['액션', '판타지', '소년물'],
  'dragon-quest': ['액션', '판타지'],
  'dragon-ball': ['액션', '판타지', '소년물'],
  disney: ['판타지'],
  digimon: ['액션', '판타지', 'SF', '소년물'],
  'Yakitate!!-Japan': ['코미디', '소년물'],
  'lala-sanrio': ['일상', '판타지'],
  'line-friends': ['일상', '코미디'],
  rako: ['일상'],
  tangled: ['판타지', '로맨스', '코미디', '음악'],
  'ranma-1-2': ['액션', '학원', '로맨스', '코미디'],
  'love-and-deepspace': ['액션', 'SF', '로맨스'],
  'love-live': ['학원', '음악', '드라마'],
  'log-horizon': ['액션', '판타지', '드라마'],
  'lobotomy-corporation': ['SF', '호러', '고어'],
  roblox: ['액션', '판타지'],
  'mega-man': ['액션', 'SF', '소년물'],
  'lupin-the-third': ['액션', '추리', '코미디'],
}

for (const [slug, values] of Object.entries(genres)) {
  if (!values.length || values.some((value) => !allowed.has(value))) throw new Error(`Invalid genres for ${slug}`)
}

const files = (await readdir(reviewDir)).filter((name) => /^batch-\d+\.json$/.test(name)).sort()
const seen = new Set()
for (const file of files) {
  const path = resolve(reviewDir, file)
  const entries = JSON.parse(await readFile(path, 'utf8'))
  for (const entry of entries) {
    const values = genres[entry.slug]
    if (!values) throw new Error(`Missing genre review for ${entry.slug}`)
    entry.genres = values
    seen.add(entry.slug)
  }
  await writeFile(path, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
}

const unused = Object.keys(genres).filter((slug) => !seen.has(slug))
if (unused.length) throw new Error(`Unused genre reviews: ${unused.join(', ')}`)
console.log(JSON.stringify({ files: files.length, reviewed: seen.size, allowed: [...allowed] }))
