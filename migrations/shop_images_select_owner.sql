-- 등록 중(status='hidden')인 샵의 사진을 소유자가 못 읽는 문제 수정
--
-- 증상: 등록 위저드 2단계에서 사진을 올리면 저장은 되는데 화면에 안 나온다.
--       등록 완료(active) 후 수정으로 들어가야 보인다.
-- 원인: shop_images_select_public 정책이 shops.status = 'active' 인 사진만 SELECT 허용.
--       등록 중 샵은 hidden이라 본인이 올린 사진도 읽지 못한다.
-- 조치: 소유자·관리자용 SELECT 정책을 "추가"한다. 정책은 OR로 합쳐지므로
--       기존 공개 정책은 그대로 두고, 공개 범위도 넓어지지 않는다.
--       (INSERT/UPDATE/DELETE 정책과 같은 조건 = owner_id 또는 admin)

drop policy if exists shop_images_select_owner on public.shop_images;

create policy shop_images_select_owner on public.shop_images
for select
to authenticated
using (
  exists (
    select 1
    from public.shops s
    where s.id = shop_images.shop_id
      and (
        s.owner_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      )
  )
);

select pg_notify('pgrst', 'reload schema');
