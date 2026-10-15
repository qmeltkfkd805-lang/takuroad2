-- 커뮤니티 글에 글자로 박힌 사진(data:/blob:) 저장 금지 + 본문 크기 상한 (2026-10-15)
-- 배경: 사진을 복사·붙여넣기하면 브라우저가 사진을 글자로 본문에 넣는다 → 글 하나가 4.7MB가 돼서
--       커뮤니티 목록 조회가 statement timeout 으로 실패했다. 화면에서도 막지만, 어떤 경로로 들어와도
--       DB가 저장을 거절하도록 한다.
-- 기존 글은 검사하지 않는다(NOT VALID) — 새로 쓰거나 고치는 글부터 적용.

alter table public.community_posts
  drop constraint if exists community_posts_content_no_inline_images;
alter table public.community_posts
  add constraint community_posts_content_no_inline_images
  check (
    content is null
    or (length(content) <= 500000
        and content !~* 'src\s*=\s*["'']?\s*(data|blob):')
  ) not valid;

alter table public.community_posts
  drop constraint if exists community_posts_images_no_inline;
alter table public.community_posts
  add constraint community_posts_images_no_inline
  check (
    images is null
    or array_to_string(images, '|') !~* '(^|\|)\s*(data|blob):'
  ) not valid;

-- [확인] 제약 2개가 보이면 성공
select conname from pg_constraint
 where conrelid = 'public.community_posts'::regclass
   and conname in ('community_posts_content_no_inline_images', 'community_posts_images_no_inline');

-- [참고] 지금 규칙에 걸리는 기존 글이 있는지 (0행이어야 정상)
select id, length(content) as content_len
  from public.community_posts
 where length(content) > 500000
    or content ~* 'src\s*=\s*["'']?\s*(data|blob):'
    or array_to_string(images, '|') ~* '(^|\|)\s*(data|blob):';
