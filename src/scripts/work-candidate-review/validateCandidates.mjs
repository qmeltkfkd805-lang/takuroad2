import fs from 'node:fs';
import path from 'node:path';

const baseDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const batchFiles = fs.readdirSync(baseDir).filter((name) => /^batch-\d{3}\.json$/.test(name)).sort();
const candidates = batchFiles.flatMap((name) => JSON.parse(fs.readFileSync(path.join(baseDir, name), 'utf8')));
const backupPath = path.resolve(baseDir, '../work-enrichment-output/pre-reviewed-apply-2026-08-10T06-57-03-088Z.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const existing = Array.isArray(backup) ? backup : (backup.rows ?? backup.works ?? backup.data ?? []);

const allowedGenres = new Set(['액션', '격투', '판타지', '모험', '학원', '일상', '가족', 'SF', '추리', '퍼즐', '로맨스', 'BL', 'GL', '코미디', '스포츠', '음악', '아이돌', '요리', '호러', '드라마', '마법소녀', '소년물', '로봇/메카', '19', '고어', '기타']);
const allowedTypes = new Set(['웹툰', '웹소설', '소설', '애니', '영화', '특촬', '만화', '버튜버', '캐릭터', '게임', '카드게임', '완구', '보컬로이드', '브랜드', '제작사']);
const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

console.log(JSON.stringify({
  batches: batchFiles.length,
  reviewed: candidates.length,
  existingRows: existing.length,
  dbDuplicates: candidates.filter((item) => existing.some((row) => row.name === item.name || row.slug === item.slug)).map((item) => item.name),
  candidateNameDuplicates: duplicates(candidates.map((item) => item.name)),
  candidateSlugDuplicates: duplicates(candidates.map((item) => item.slug)),
  badGenres: candidates.filter((item) => item.genres.some((genre) => !allowedGenres.has(genre))).map((item) => item.name),
  badTypes: candidates.filter((item) => item.ipType.some((type) => !allowedTypes.has(type))).map((item) => item.name),
  over80: candidates.filter((item) => [...item.description].length > 80).map((item) => [item.name, [...item.description].length]),
  officialBlank: candidates.filter((item) => !item.officialUrl).map((item) => item.name),
}, null, 2));
