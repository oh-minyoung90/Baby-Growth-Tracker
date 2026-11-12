-- T-47: 레시피·재료·사진 메타데이터와 소유권 제약. 파일 저장소 정책은 T-48에서 추가한다.
create function public.valid_recipe_steps(steps jsonb)
returns boolean language sql immutable parallel safe set search_path = ''
as $$
  select case when jsonb_typeof(steps) = 'array' then
    jsonb_array_length(steps) > 0 and not exists (
      select 1 from jsonb_array_elements(steps) x
      where jsonb_typeof(x) <> 'string' or char_length(btrim(x #>> '{}')) = 0
    ) else false end;
$$;

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photos_id_owner_key unique(id, owner_id),
  constraint photos_storage_path_check check (storage_path = owner_id::text || '/' || id::text || '.jpg')
);
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  servings text,
  steps jsonb not null,
  note text,
  photo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_id_owner_key unique(id, owner_id),
  constraint recipes_name_length check (char_length(btrim(name)) between 1 and 30),
  constraint recipes_servings_length check (char_length(servings) <= 20),
  constraint recipes_note_length check (char_length(note) <= 500),
  constraint recipes_steps_check check (public.valid_recipe_steps(steps)),
  constraint recipes_photo_key unique(photo_id),
  constraint recipes_photo_fkey foreign key (photo_id, owner_id)
    references public.photos(id, owner_id) on delete set null (photo_id)
);
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_id uuid not null,
  food_id uuid,
  name text not null,
  amount text,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_ingredients_recipe_fkey foreign key (recipe_id, owner_id)
    references public.recipes(id, owner_id) on delete cascade,
  constraint recipe_ingredients_food_fkey foreign key (food_id, owner_id)
    references public.foods(id, owner_id) on delete set null (food_id),
  constraint recipe_ingredients_name_length check (char_length(btrim(name)) between 1 and 20),
  constraint recipe_ingredients_amount_length check (char_length(amount) <= 20),
  constraint recipe_ingredients_position_check check (position >= 0),
  constraint recipe_ingredients_recipe_position_key unique(recipe_id, position)
);
create index recipe_ingredients_food_id_idx on public.recipe_ingredients(food_id);
create index recipes_owner_name_idx on public.recipes(owner_id, name);

create trigger photos_set_updated_at before update on public.photos
  for each row execute function public.set_updated_at();
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
create trigger recipe_ingredients_set_updated_at before update on public.recipe_ingredients
  for each row execute function public.set_updated_at();

alter table public.photos enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
create policy "본인 사진만 조회" on public.photos for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 사진만 추가" on public.photos for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 사진만 삭제" on public.photos for delete to authenticated using ((select auth.uid()) = owner_id);
-- 사진 ID와 파일 경로는 업로드 후 바꾸지 않는다.
revoke update on public.photos from anon, authenticated;
create policy "본인 레시피만 조회" on public.recipes for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 레시피만 추가" on public.recipes for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 레시피만 수정" on public.recipes for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 레시피만 삭제" on public.recipes for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 재료만 조회" on public.recipe_ingredients for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 재료만 추가" on public.recipe_ingredients for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 재료만 수정" on public.recipe_ingredients for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 재료만 삭제" on public.recipe_ingredients for delete to authenticated using ((select auth.uid()) = owner_id);

-- T-47 이전에 저장된 임의 ID는 이름 스냅샷을 보존하고 연결만 끊는다.
update public.meal_entry_recipes er set recipe_id = null
where er.recipe_id is not null and not exists (
  select 1 from public.recipes r where r.id = er.recipe_id and r.owner_id = er.owner_id
);
alter table public.meal_entry_recipes add constraint meal_entry_recipes_recipe_fkey
  foreign key (recipe_id, owner_id) references public.recipes(id, owner_id)
  on delete set null (recipe_id);

comment on table public.photos is '비공개 레시피 사진 메타데이터. 파일 경로는 본인 UUID/사진 UUID.jpg (T-47)';
comment on table public.recipes is '레시피: 이름·완성량·조리 순서·참고·사진 1장. 같은 이름 허용 (T-47)';
comment on table public.recipe_ingredients is '순서가 있는 재료. 음식 삭제 시 연결만 끊고 이름을 보존 (T-47, D8)';

-- 식단 저장의 레시피 소유권·현재 이름 검증을 완성한다. 재료 음식은 재계산하지 않는다.
create or replace function public.save_meal_entry(
  id uuid default null,
  date date default null,
  meal_type text default null,
  eaten boolean default false,
  foods jsonb default '[]'::jsonb,
  recipes jsonb default '[]'::jsonb,
  intake text default null,
  memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  entry_id uuid;
  affected uuid[];
  first_tried jsonb;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  if foods is null or recipes is null
    or jsonb_typeof(foods) <> 'array' or jsonb_typeof(recipes) <> 'array' then
    raise exception using errcode = '22023', message = '음식과 레시피는 배열이어야 합니다';
  end if;
  if jsonb_array_length(foods) + jsonb_array_length(recipes) = 0 then
    raise exception using errcode = '22023', message = '음식이나 레시피를 하나 이상 선택해 주세요';
  end if;
  if exists (select 1 from jsonb_array_elements(foods) x where jsonb_typeof(x) <> 'object')
    or exists (select 1 from jsonb_array_elements(recipes) x where jsonb_typeof(x) <> 'object') then
    raise exception using errcode = '22023', message = '음식과 레시피 항목의 형식이 올바르지 않습니다';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('meal:' || uid::text, 0));
  if save_meal_entry.id is not null then
    select e.id into entry_id from public.meal_entries e
    where e.id = save_meal_entry.id and e.owner_id = uid for update;
    if not found then
      raise exception using errcode = 'P0002', message = '식단을 찾을 수 없습니다';
    end if;
  end if;

  select coalesce(array_agg(distinct food_id), '{}'::uuid[]) into affected from (
    select ef.food_id from public.meal_entry_foods ef
    where ef.meal_entry_id = entry_id and ef.owner_id = uid
    union
    select (x ->> 'food_id')::uuid from jsonb_array_elements(foods) x
  ) related where food_id is not null;
  perform f.id from public.foods f
  where f.id = any(affected) and f.owner_id = uid order by f.id for update;
  if exists (
    select 1 from jsonb_array_elements(foods) x
    where (x ->> 'food_id') is not null and not exists (
      select 1 from public.foods f where f.id = (x ->> 'food_id')::uuid and f.owner_id = uid
    )
  ) then
    raise exception using errcode = '23503', message = '본인의 음식만 선택할 수 있습니다';
  end if;

  -- 이름과 소유권을 확인한 레시피만 연결한다. 삭제와 경합하지 않게 키를 잠근다.
  perform r.id from public.recipes r
  where r.owner_id = uid and r.id in (
    select (x ->> 'recipe_id')::uuid from jsonb_array_elements(recipes) x
  ) order by r.id for key share;
  if exists (
    select 1 from jsonb_array_elements(recipes) x
    where (x ->> 'recipe_id') is not null and not exists (
      select 1 from public.recipes r where r.id = (x ->> 'recipe_id')::uuid and r.owner_id = uid
    )
  ) then
    raise exception using errcode = '23503', message = '본인의 레시피만 선택할 수 있습니다';
  end if;

  if entry_id is null then
    insert into public.meal_entries (owner_id, date, meal_type, eaten, intake, memo)
    values (uid, save_meal_entry.date, save_meal_entry.meal_type, save_meal_entry.eaten,
      save_meal_entry.intake, save_meal_entry.memo)
    returning meal_entries.id into entry_id;
  else
    -- 날짜·체크가 그대로면 날짜 검증 트리거를 다시 실행하지 않는다 (T-39).
    update public.meal_entries e set intake = save_meal_entry.intake, memo = save_meal_entry.memo
    where e.id = entry_id and e.owner_id = uid;
    update public.meal_entries e set date = save_meal_entry.date,
      meal_type = save_meal_entry.meal_type, eaten = save_meal_entry.eaten
    where e.id = entry_id and e.owner_id = uid
      and (e.date is distinct from save_meal_entry.date
        or e.meal_type is distinct from save_meal_entry.meal_type
        or e.eaten is distinct from save_meal_entry.eaten);
    delete from public.meal_entry_foods ef where ef.meal_entry_id = entry_id and ef.owner_id = uid;
    delete from public.meal_entry_recipes er where er.meal_entry_id = entry_id and er.owner_id = uid;
  end if;

  insert into public.meal_entry_foods (owner_id, meal_entry_id, food_id, food_name, position)
  select uid, entry_id, (x.value ->> 'food_id')::uuid,
    coalesce(f.name, x.value ->> 'food_name'), x.ordinality::integer - 1
  from jsonb_array_elements(foods) with ordinality x(value, ordinality)
  left join public.foods f on f.id = (x.value ->> 'food_id')::uuid and f.owner_id = uid;
  insert into public.meal_entry_recipes (owner_id, meal_entry_id, recipe_id, recipe_name, position)
  select uid, entry_id, (x.value ->> 'recipe_id')::uuid,
    coalesce(r.name, x.value ->> 'recipe_name'), x.ordinality::integer - 1
  from jsonb_array_elements(recipes) with ordinality x(value, ordinality)
  left join public.recipes r on r.id = (x.value ->> 'recipe_id')::uuid and r.owner_id = uid;

  first_tried := public.recalc_meal_foods(affected, entry_id);
  return jsonb_build_object('id', entry_id, 'first_tried_foods', first_tried);
end;
$$;
