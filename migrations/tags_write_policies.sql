-- ============================================================
-- tags 쓰기 정책 정리  [적용 완료 2026-09-10]
--
-- 문제
--   tags_authenticated_update 가 using(true) with check(true) 로
--   로그인한 모든 사용자에게 작품 전체(1,992건) 수정을 허용하고 있었다.
--   이름·설명·커버·장르는 물론 created_by 까지 바꿀 수 있었다.
--   tags_owner_update(본인 것만)와 tags_admin_update(관리자)가 따로 있었지만
--   RLS 정책은 OR 로 합쳐지므로 이 정책이 그 둘을 무의미하게 만들었다.
--
-- ⚠️ 조사 중 한 번 오판했던 지점
--   information_schema.table_privileges / column_privileges 를
--   grantee in ('anon','authenticated') 로 조회하면 tags 가 안 잡힌다.
--   권한이 그 역할이 아니라 PUBLIC 에 부여돼 있기 때문이다.
--   PUBLIC 경유 권한까지 보려면 has_table_privilege 를 쓸 것.
--     select has_table_privilege('authenticated','public.tags','UPDATE');
--   이걸로 확인해서 "권한이 없어 잠복 상태"가 아니라 "지금 열려 있음"을 확정했다.
--
-- 관리자 작품 수정은 /api/admin/upsert (service_role, tags 화이트리스트) 경로라
-- 이 변경의 영향을 받지 않는다.
-- ============================================================

-- 1) 전체 수정 허용 제거
drop policy if exists tags_authenticated_update on public.tags;

-- 2) 등록 시 created_by 를 본인으로 강제
--    작품 등록 기능 자체는 검수 정책이 정해질 때까지 UI 에서 막지만,
--    정책은 지금 좁혀둔다.
drop policy if exists tags_user_insert on public.tags;
create policy tags_user_insert on public.tags
  for insert to authenticated
  with check (auth.uid() is not null and created_by = auth.uid());

-- 3) 소유자 수정 — with_check 를 명시해 created_by 를 남에게 넘길 수 없게
drop policy if exists tags_owner_update on public.tags;
create policy tags_owner_update on public.tags
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- 4) 동일한 공개 읽기 정책이 둘이었다 (tags_public_read / tags_select_public,
--    정의가 both `using (true)` 로 같다). 하나만 남긴다.
drop policy if exists tags_public_read on public.tags;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 상태 — 확인됨]
--   tags_write_admin    ALL     admin
--   tags_user_insert    INSERT  authenticated  with_check: created_by = auth.uid()
--   tags_select_public  SELECT  public         using: true
--   tags_admin_update   UPDATE  admin
--   tags_owner_update   UPDATE  authenticated  using/with_check: created_by = auth.uid()
-- ============================================================

-- ============================================================
-- [롤백]
--   ⚠️ 전체 수정 허용 정책(tags_authenticated_update)은 절대 되살리지 않는다.
-- ============================================================
-- drop policy if exists tags_user_insert on public.tags;
-- create policy tags_user_insert on public.tags for insert with check (auth.uid() is not null);
-- drop policy if exists tags_owner_update on public.tags;
-- create policy tags_owner_update on public.tags for update using (auth.uid() = created_by);
-- create policy tags_public_read on public.tags for select using (true);
-- select pg_notify('pgrst', 'reload schema');
