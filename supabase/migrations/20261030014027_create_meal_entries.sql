-- T-39: 식단 칸(meal_entries)과 칸에 담긴 음식·레시피(meal_entry_foods, meal_entry_recipes)
-- 기준: 기술요구사항서 5.3, 5.4, 6.1, D2, D7, 기능요구사항서 FR-MEAL-03~07, F-15
-- 이 파일은 테이블·제약·RLS까지 둔다. 칸 저장·체크·이동·삭제 함수와 음식 상태 재계산은 T-40·T-41에서 더한다.
-- 그때까지는 RLS 안에서 화면이 직접 쓸 수 있다. 함수가 생기면(T-40) 음식 상태와 어긋나지 않게 직접 쓰기를 막는다 (D10과 같은 이유).

-- ---------------------------------------------------------------
-- meal_entries: 주간 식단의 한 칸 (F-15). 날짜·끼니당 1건
-- ---------------------------------------------------------------
create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  meal_type text not null,
  -- true: "먹음" 칸, false: 계획 칸 (FR-MEAL-03, 07)
  eaten boolean not null,
  -- 먹은 정도 (선택): 잘 먹음 / 보통 / 거부 (FR-MEAL-05)
  intake text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_entries_owner_date_meal_type_key unique (owner_id, date, meal_type),
  -- 칸에 담긴 음식·레시피가 같은 사람의 칸만 가리키게 하는 외래 키의 대상
  constraint meal_entries_id_owner_key unique (id, owner_id),
  constraint meal_entries_meal_type_check
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  constraint meal_entries_intake_check check (intake in ('good', 'normal', 'refuse')),
  constraint meal_entries_memo_length check (char_length(memo) <= 500)
);

comment on table public.meal_entries is
  '주간 식단의 한 칸 (F-15). 날짜·끼니당 1건. 계획 칸(eaten=false)은 미래 날짜도 허용';
comment on column public.meal_entries.eaten is '"먹음" 체크. 체크한 칸만 음식 상태에 반영한다 (BR-11~12)';

create trigger meal_entries_set_updated_at
  before update on public.meal_entries
  for each row execute function public.set_updated_at();

-- "먹음" 칸은 미래 날짜일 수 없다 (FR-MEAL-07, D2: 현재 UTC 날짜 + 1일까지). 계획 칸은 미래도 허용한다.
-- 날짜나 체크가 바뀔 때만 검사해, 메모만 고치는 저장은 막지 않는다
create trigger meal_entries_reject_future_eaten
  before insert or update of date, eaten on public.meal_entries
  for each row
  when (new.eaten)
  execute function public.reject_future_date('date');

-- ---------------------------------------------------------------
-- meal_entry_foods / meal_entry_recipes: 칸에 담긴 음식·레시피 (D7)
-- 저장할 때의 이름을 함께 둔다. 음식·레시피를 지우면 연결만 끊기고(null) 이름은 남는다 (FR-FOOD-08).
-- 칸과 음식은 (id, owner_id)로 참조해 다른 사람의 칸·음식을 가리킬 수 없게 한다.
-- ---------------------------------------------------------------
alter table public.foods add constraint foods_id_owner_key unique (id, owner_id);

create table public.meal_entry_foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_entry_id uuid not null,
  food_id uuid,
  food_name text not null,
  position integer not null,
  constraint meal_entry_foods_meal_entry_fkey foreign key (meal_entry_id, owner_id)
    references public.meal_entries (id, owner_id) on delete cascade,
  constraint meal_entry_foods_food_fkey foreign key (food_id, owner_id)
    references public.foods (id, owner_id) on delete set null (food_id),
  -- 한 칸에 같은 음식은 한 번만 (먹은 횟수를 두 번 세지 않게)
  constraint meal_entry_foods_meal_entry_food_key unique (meal_entry_id, food_id),
  constraint meal_entry_foods_meal_entry_position_key unique (meal_entry_id, position),
  constraint meal_entry_foods_food_name_length check (char_length(btrim(food_name)) between 1 and 20),
  constraint meal_entry_foods_position_check check (position >= 0)
);

comment on table public.meal_entry_foods is
  '식단 칸에 담긴 음식 (D7). 음식을 지우면 food_id만 null이 되고 food_name은 남는다';
comment on column public.meal_entry_foods.food_name is '저장할 때의 음식 이름. 음식이 지워진 뒤 표시용';

-- 음식별 "먹음" 칸 찾기(처음 먹은 날·먹은 횟수, T-40)
create index meal_entry_foods_food_id_idx on public.meal_entry_foods (food_id);

create table public.meal_entry_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_entry_id uuid not null,
  -- recipes 테이블은 T-47에서 만든다. 외래 키(레시피 삭제 시 null)는 그때 더한다
  recipe_id uuid,
  recipe_name text not null,
  position integer not null,
  constraint meal_entry_recipes_meal_entry_fkey foreign key (meal_entry_id, owner_id)
    references public.meal_entries (id, owner_id) on delete cascade,
  constraint meal_entry_recipes_meal_entry_recipe_key unique (meal_entry_id, recipe_id),
  constraint meal_entry_recipes_meal_entry_position_key unique (meal_entry_id, position),
  constraint meal_entry_recipes_recipe_name_length
    check (char_length(btrim(recipe_name)) between 1 and 30),
  constraint meal_entry_recipes_position_check check (position >= 0)
);

comment on table public.meal_entry_recipes is
  '식단 칸에 담긴 레시피 (D7). 레시피를 기록해도 재료 음식의 상태는 바뀌지 않는다 (BR-15)';
comment on column public.meal_entry_recipes.recipe_name is '저장할 때의 레시피 이름. 레시피가 지워진 뒤 표시용';

create index meal_entry_recipes_recipe_id_idx on public.meal_entry_recipes (recipe_id);

-- ---------------------------------------------------------------
-- food_status_history.meal_entry_id: 이력을 만든 식단 칸 (T-36에서 미뤄 둔 외래 키). 칸을 지우면 null
-- ---------------------------------------------------------------
alter table public.food_status_history
  add constraint food_status_history_meal_entry_id_fkey
  foreign key (meal_entry_id) references public.meal_entries (id) on delete set null;

-- ---------------------------------------------------------------
-- RLS: 본인 데이터만 (기술요구사항서 6.1). 다른 테이블과 같은 형태
-- ---------------------------------------------------------------
alter table public.meal_entries enable row level security;

create policy "본인 데이터만 조회" on public.meal_entries
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 데이터만 추가" on public.meal_entries
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 수정" on public.meal_entries
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 삭제" on public.meal_entries
  for delete to authenticated using ((select auth.uid()) = owner_id);

alter table public.meal_entry_foods enable row level security;

create policy "본인 데이터만 조회" on public.meal_entry_foods
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 데이터만 추가" on public.meal_entry_foods
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 수정" on public.meal_entry_foods
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 삭제" on public.meal_entry_foods
  for delete to authenticated using ((select auth.uid()) = owner_id);

alter table public.meal_entry_recipes enable row level security;

create policy "본인 데이터만 조회" on public.meal_entry_recipes
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 데이터만 추가" on public.meal_entry_recipes
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 수정" on public.meal_entry_recipes
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 삭제" on public.meal_entry_recipes
  for delete to authenticated using ((select auth.uid()) = owner_id);
