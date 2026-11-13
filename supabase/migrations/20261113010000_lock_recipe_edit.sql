-- T-50: 존재 확인과 저장 사이의 삭제 경합을 막는다. FK 조회의 KEY SHARE와는 호환된다.
-- 클라이언트가 만든 안정적인 ID를 사용해 응답 유실 후 재시도해도 중복 생성되지 않는다.
create or replace function public.save_recipe(
  id uuid,
  name text,
  ingredients jsonb,
  steps jsonb,
  servings text default null,
  note text default null,
  photo_id uuid default null,
  create_new boolean default false
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  if id is null or ingredients is null or jsonb_typeof(ingredients) <> 'array' then
    raise exception using errcode = '22023', message = '재료를 하나 이상 입력해 주세요';
  end if;
  if jsonb_array_length(ingredients) = 0 or exists (
    select 1 from jsonb_array_elements(ingredients) x
    where jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'name') is distinct from 'string'
      or (x ? 'amount' and jsonb_typeof(x->'amount') not in ('string', 'null'))
  ) then
    raise exception using errcode = '22023', message = '재료를 하나 이상 올바르게 입력해 주세요';
  end if;
  -- 같은 레시피의 저장·재시도를 직렬화한다. 타인의 ID를 덮어쓰지 않는다.
  perform pg_advisory_xact_lock(hashtextextended('recipe:' || id::text, 0));
  if exists (select 1 from public.recipes r where r.id = save_recipe.id and r.owner_id <> uid) then
    raise exception using errcode = '42501', message = '본인의 레시피만 저장할 수 있습니다';
  end if;
  perform r.id from public.recipes r where r.id = save_recipe.id and r.owner_id = uid for no key update;
  if not found and not create_new then
    raise exception using errcode = 'P0002', message = '레시피를 찾을 수 없습니다';
  end if;
  perform f.id from public.foods f where f.owner_id = uid and f.id in (
    select (x->>'food_id')::uuid from jsonb_array_elements(ingredients) x
  ) order by f.id for key share;
  if exists (
    select 1 from jsonb_array_elements(ingredients) x where x->>'food_id' is not null
      and not exists (select 1 from public.foods f where f.id = (x->>'food_id')::uuid and f.owner_id = uid)
  ) then
    raise exception using errcode = '23503', message = '본인의 음식만 선택할 수 있습니다';
  end if;
  insert into public.recipes as r (id, owner_id, name, servings, steps, note, photo_id)
  values (id, uid, btrim(name), nullif(btrim(servings), ''), steps, nullif(btrim(note), ''), photo_id)
  on conflict on constraint recipes_pkey do update set name = excluded.name,
    servings = excluded.servings, steps = excluded.steps, note = excluded.note, photo_id = excluded.photo_id
    where r.owner_id = uid;
  delete from public.recipe_ingredients i where i.recipe_id = save_recipe.id and i.owner_id = uid;
  insert into public.recipe_ingredients (owner_id, recipe_id, food_id, name, amount, position)
  select uid, save_recipe.id, (x.value->>'food_id')::uuid,
    coalesce(f.name, btrim(x.value->>'name')), nullif(btrim(x.value->>'amount'), ''), x.ordinality::integer - 1
  from jsonb_array_elements(ingredients) with ordinality x(value, ordinality)
  left join public.foods f on f.id = (x.value->>'food_id')::uuid and f.owner_id = uid;
  return id;
end;
$$;
revoke all on function public.save_recipe(uuid, text, jsonb, jsonb, text, text, uuid, boolean) from public, anon;
grant execute on function public.save_recipe(uuid, text, jsonb, jsonb, text, text, uuid, boolean) to authenticated;
