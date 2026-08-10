import fs from 'node:fs'
import path from 'node:path'

const reviewDir = path.resolve('scripts/work-description-review')
const typesBySlug = new Map()
const add = (type, slugs) => {
  for (const slug of slugs.split(/\s+/).filter(Boolean)) {
    const values = typesBySlug.get(slug) ?? []
    if (!values.includes(type)) values.push(type)
    typesBySlug.set(slug, values)
  }
}

add('웹소설', `solo-leveling shield-hero mushoku-tensei`)
add('웹툰', `solo-leveling`)
add('소설', `86-eighty-six kara-no-kyokai winnie-the-pooh no-game-no-life danmachi date-a-live log-horizon violet-evergarden moomin`)
add('영화', `godzilla frozen tangled lilo-and-stitch kikis-delivery-service moana monsters-inc minions`)
add('특촬', `kamen-rider`)
add('브랜드', `disney marvel`)
add('완구', `tamagotchi`)

add('게임', `
  a3 afk-journey air d4dj fate kanon black-desert-online umineko nier-automata tamagotchi
  dark-souls king-of-fighters dungeon-fighter devil-may-cry touken-ranbu animal-crossing
  touhou-project donkey-kong duel-masters dragon-quest digimon love-and-deepspace love-live
  lobotomy-corporation roblox mega-man league-of-legends limbus-company witch-on-the-holy-night
  mabinogi minecraft magic-the-gathering maplestory metaphor-refantazio metroid arknights
  wuthering-waves monster-strike monster-hunter weiss-schwarz resident-evil valorant
`)

add('버튜버', `aogiri-high-school nijisanji`)

add('캐릭터', `
  bt21 gundam winnie-the-pooh digimon lala-sanrio line-friends rako
  rilakkuma little-twin-stars marumofubiyori marvel my-melody momonga molang moomin minions
  mickey-mouse miffy barbapapa badtz-maru tamagotchi
`)

add('만화', `
  100-girlfriends 5toubun-no-hanayome d-gray-man fullmetal-alchemist girls-band-cry
  girls-und-panzer yowamushi-pedal kaiju-no-8 mysterious-disappearances demon-slayer
  my-dress-up-darling solo-leveling my-hero-academia the-dangers-in-my-heart nisekoi UFO-Baby
  diamond-no-ace dr-stone dandadan danmachi death-note date-a-live doraemon dorohedoro
  the-elusive-samurai tokyo-revengers duel-masters dragon-ball Yakitate!!-Japan ranma-1-2
  log-horizon lupin-the-third mairimashita-iruma-kun the-witch-and-the-beast ancient-magus-bride
  madoka-magica mashle made-in-abyss detective-conan mob-psycho-100 mushoku-tensei
  bungo-stray-dogs bakuman shield-hero
`)

add('애니', `
  100-girlfriends 5toubun-no-hanayome 86-eighty-six a3 air charlotte d-gray-man d4dj fate
  id-invaded kanon fullmetal-alchemist gundam girls-band-cry girls-und-panzer yowamushi-pedal
  frozen kara-no-kyokai kaiju-no-8 mysterious-disappearances demon-slayer my-dress-up-darling
  solo-leveling my-hero-academia the-dangers-in-my-heart no-game-no-life nisekoi nier-automata
  UFO-Baby diamond-no-ace dr-stone dandadan darling-in-the-franxx danmachi devil-may-cry
  death-note date-a-live touken-ranbu doraemon dorohedoro the-elusive-samurai tokyo-revengers
  animal-crossing duel-masters dragon-quest dragon-ball digimon Yakitate!!-Japan tangled
  ranma-1-2 love-live log-horizon mega-man lupin-the-third lycoris-recoil lilo-and-stitch
  mairimashita-iruma-kun kikis-delivery-service the-witch-and-the-beast ancient-magus-bride
  madoka-magica macross made-in-abyss mashle detective-conan mob-psycho-100 moana
  monster-strike monsters-inc molang moomin mushoku-tensei bungo-stray-dogs minions
  mickey-mouse barbapapa violet-evergarden bakuman shield-hero
`)

const allowed = new Set(['웹툰', '웹소설', '소설', '애니', '영화', '특촬', '만화', '버튜버', '캐릭터', '게임', '완구', '보컬로이드', '브랜드'])
const files = fs.readdirSync(reviewDir).filter((name) => /^batch-\d+\.json$/.test(name)).sort()
const missing = []

for (const file of files) {
  const filePath = path.join(reviewDir, file)
  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  for (const row of rows) {
    const types = typesBySlug.get(row.slug)
    if (!types?.length) missing.push(row.slug)
    else row.ipType = types
  }
  fs.writeFileSync(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

if (missing.length) throw new Error(`유형 미지정: ${missing.join(', ')}`)
for (const [slug, types] of typesBySlug) {
  if (types.some((type) => !allowed.has(type))) throw new Error(`허용되지 않은 유형: ${slug}`)
}

console.log(`유형 추가 완료: ${files.length}개 파일, ${typesBySlug.size}개 작품`)
