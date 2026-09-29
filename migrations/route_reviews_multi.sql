-- 루트 완주 후기: 1인 1개 → 완주할 때마다 1개씩
-- (visit_counts.sql 의 route_completion_runs 표가 먼저 있어야 해요)

-- 1) "같은 사람은 같은 루트에 후기 1개" 규칙 풀기
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
     where con.conrelid = 'public.route_reviews'::regclass and con.contype = 'u'
  loop
    execute format('alter table public.route_reviews drop constraint %I', c);
  end loop;
end $$;
create index if not exists route_reviews_user_route_idx on public.route_reviews (user_id, route_id, created_at);

-- 2) 후기를 더 쓸 수 있는지 — 정책 안에서 route_reviews 를 다시 읽으면 무한 반복 에러가 나서 함수로 뺀다
create or replace function public.can_add_route_review(p_route uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.route_completions c where c.route_id = p_route and c.user_id = auth.uid())
     and (select count(*) from public.route_reviews x where x.route_id = p_route and x.user_id = auth.uid())
         < greatest(1, (select count(*) from public.route_completion_runs rr where rr.route_id = p_route and rr.user_id = auth.uid()));
$$;
revoke all on function public.can_add_route_review(uuid) from public, anon;
grant execute on function public.can_add_route_review(uuid) to authenticated;

-- 3) 쓰기 조건: 내 글 + 완주 횟수만큼
drop policy if exists rr_insert_own on public.route_reviews;
create policy rr_insert_own on public.route_reviews
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_add_route_review(route_id));
