-- 롤백 — 작품 생성을 다시 로그인 사용자 전체에게 허용
-- (migrations/tags_insert_admin_only.sql 되돌리기)
-- 2026-09-22 삭제 직전 정의를 그대로 복원한다.

create policy tags_user_insert on public.tags
  as permissive
  for insert
  to authenticated
  with check ((auth.uid() is not null) and (created_by = auth.uid()));
