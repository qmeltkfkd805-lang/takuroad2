-- 목록용 작은 사진(썸네일) 저장소 — Supabase 사진 전송량(Cached Egress) 줄이기
--
-- 원본 사진은 그대로 두고, 목록·카드·지도에서 쓸 가로 480px webp 를 따로 저장한다.
--   원본:   public/{버킷}/{경로}
--   썸네일: public/thumbs/{버킷}/{경로}.webp
-- 썸네일은 서버(/api/thumb, service role)만 만든다. 누구나 읽을 수 있다(공개 버킷).
-- 기존 데이터·파일은 건드리지 않는다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbs', 'thumbs', true, 1048576, array['image/webp'])
on conflict (id) do nothing;

-- 쓰기 정책은 만들지 않는다 → 일반 사용자는 못 올리고, service role(서버)만 올린다.

-- [확인] select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'thumbs';
-- [롤백] (썸네일 파일을 먼저 지운 뒤) delete from storage.buckets where id = 'thumbs';
