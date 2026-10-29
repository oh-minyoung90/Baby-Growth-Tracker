-- T-36: 음식 목록(foods), 상태 변경 이력(food_status_history), 음식 추가·기본 음식 함수
-- 기준: 기술요구사항서 5.3, 6.2, 8.2(D10), 기능요구사항서 FR-FOOD-04~07, BR-10, BR-13, BR-17~18, 부록 B
-- 상태(status)와 처음 먹은 날은 화면에서 직접 바꾸지 않고 DB 함수로만 바꾼다 (D10).
-- 이 파일은 음식 추가 함수까지만 두고, 식단에 따른 상태 재계산(T-40)과 알러지·주의 지정(T-38)은 뒤에서 더한다.

-- ---------------------------------------------------------------
-- foods: 음식 목록 (F-13, F-14)
-- ---------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  -- BR-18 이름 비교 키. 발달 기록 title_key(BR-03)와 같은 규칙 (src/domain/text.ts의 toContentKey):
  -- NFC 정규화 → 앞뒤 공백 제거 → 연속 공백 하나로 → 소문자
  name_key text generated always as (
    lower(regexp_replace(btrim(normalize(name, NFC)), '\s+', ' ', 'g'))
  ) stored,
  food_group text not null,
  status text not null default 'not_tried',
  caution_tag boolean not null default false,
  first_tried_date date,
  manual_tried boolean not null default false,
  manual_first_tried_date date,
  preference text,
  memo text,
  reaction_date date,
  symptom_note text,
  check_note text,
  caution_since date,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_owner_name_key_key unique (owner_id, name_key),
  constraint foods_name_length check (char_length(btrim(name)) between 1 and 20),
  constraint foods_food_group_check
    check (food_group in ('grain', 'vegetable', 'fruit', 'protein', 'dairy', 'etc')),
  constraint foods_status_check check (status in ('not_tried', 'tried', 'caution')),
  constraint foods_preference_check check (preference in ('like', 'neutral', 'refuse')),
  constraint foods_memo_length check (char_length(memo) <= 500),
  constraint foods_symptom_note_length check (char_length(symptom_note) <= 500),
  constraint foods_check_note_length check (char_length(check_note) <= 500),
  -- "주의" 태그는 먹어봄에만 붙는다 (BR-10)
  constraint foods_caution_tag_only_tried check (not caution_tag or status = 'tried'),
  -- 직접 입력한 처음 먹은 날은 "이미 먹어 봤어요"로 추가한 음식에만 있다 (BR-17)
  constraint foods_manual_date_only_manual check (manual_first_tried_date is null or manual_tried),
  -- "이미 먹어 봤어요" 음식은 먹은 기록이 있는 것으로 보므로 아직 안 먹어봄이 되지 않는다 (BR-17)
  constraint foods_manual_tried_not_untried check (not manual_tried or status <> 'not_tried')
);

comment on table public.foods is
  '음식 목록 (F-13, F-14). 같은 이름(BR-18 name_key)은 계정당 1개. 상태 컬럼은 DB 함수로만 바뀐다 (D10)';
comment on column public.foods.name_key is 'BR-18 이름 비교 키 (자동 생성)';
comment on column public.foods.first_tried_date is
  '처음 먹은 날: 가장 이른 "먹음" 칸 날짜와 manual_first_tried_date 중 이른 날 (BR-12, BR-17)';
comment on column public.foods.manual_tried is '"이미 먹어 봤어요"로 추가한 음식 (FR-FOOD-05, BR-17)';
comment on column public.foods.caution_since is '알러지·주의로 지정한 날. 주의 태그 되돌림 기준 (D11)';
comment on column public.foods.is_default is '기본 음식 목록(부록 B)에서 추가된 음식 (FR-FOOD-07)';

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

-- 직접 입력한 처음 먹은 날: 미래·생년월일 이전 거부 (FR-COM-02~04).
-- 이 날짜가 바뀔 때만 검사해, 생년월일을 고친 뒤에도 이름·메모 수정은 막지 않는다.
create trigger foods_reject_future_first_tried
  before insert or update of manual_first_tried_date on public.foods
  for each row execute function public.reject_future_date('manual_first_tried_date');

create trigger foods_reject_first_tried_before_birth
  before insert or update of manual_first_tried_date on public.foods
  for each row execute function public.reject_before_birth('manual_first_tried_date');

-- ---------------------------------------------------------------
-- food_status_history: 상태 변경 이력 (BR-13). DB 함수만 쓰고, 화면은 조회만 한다
-- ---------------------------------------------------------------
create table public.food_status_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  changed_at timestamptz not null default now(),
  from_status text not null,
  to_status text not null,
  -- 변경 후 "주의" 태그 여부
  caution_tag boolean not null default false,
  trigger text not null,
  -- 이 변경을 일으킨 식단 칸. meal_entries는 T-39에서 만들고, 그때 외래 키(식단 삭제 시 null)를 더한다
  meal_entry_id uuid,
  reason text,
  constraint food_status_history_from_status_check
    check (from_status in ('not_tried', 'tried', 'caution')),
  constraint food_status_history_to_status_check
    check (to_status in ('not_tried', 'tried', 'caution')),
  constraint food_status_history_trigger_check check (trigger in ('manual', 'meal_entry', 'revert')),
  constraint food_status_history_reason_length check (char_length(reason) <= 500)
);

comment on table public.food_status_history is
  '음식 상태 변경 이력 (BR-13). 음식을 지우면 함께 지워진다';
comment on column public.food_status_history.trigger is
  'manual: 사용자 지정·해제, meal_entry: 식단 "먹음"으로 자동 전환, revert: 되돌림 (BR-11)';

-- 음식 상세의 이력 목록(최신순, FR-FOOD-09)
create index food_status_history_food_changed_idx
  on public.food_status_history (food_id, changed_at desc);

-- ---------------------------------------------------------------
-- RLS: 본인 데이터만 (기술요구사항서 6.1). 정책은 다른 테이블과 같은 형태로 두고,
-- 화면에서 할 수 있는 일은 아래 권한으로 한 번 더 좁힌다.
-- ---------------------------------------------------------------
alter table public.foods enable row level security;

create policy "본인 데이터만 조회" on public.foods
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 데이터만 추가" on public.foods
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 수정" on public.foods
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 삭제" on public.foods
  for delete to authenticated using ((select auth.uid()) = owner_id);

alter table public.food_status_history enable row level security;

create policy "본인 데이터만 조회" on public.food_status_history
  for select to authenticated using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------
-- 상태 컬럼 보호 (D10, FR-FOOD-06)
-- Supabase는 새 테이블에 anon·authenticated 전체 권한을 주므로 테이블 단위 권한을 빼고 필요한 것만 다시 준다.
-- - foods: 조회·삭제는 그대로. 추가는 add_food()·seed_default_foods()로만 하고,
--   화면에서 바로 수정하는 컬럼은 이름·식품군·메모·반응뿐이다 (기술요구사항서 5.3).
--   상태, 주의 태그, 처음 먹은 날, 알러지·주의 정보 등은 8.2의 DB 함수로만 바뀐다.
-- - food_status_history: 조회만. 음식을 지우면 외래 키로 함께 지워진다.
-- ---------------------------------------------------------------
revoke insert, update on public.foods from anon, authenticated;
grant update (name, food_group, memo, preference) on public.foods to authenticated;

revoke insert, update, delete on public.food_status_history from anon, authenticated;

-- ---------------------------------------------------------------
-- add_food: 음식 추가 (FR-FOOD-04~05, BR-17)
-- "이미 먹어 봤어요"(already_tried)면 manual_tried와 상태 먹어봄으로 저장하고,
-- 입력한 처음 먹은 날(선택)을 그대로 처음 먹은 날로 둔다 (아직 식단 기록이 없으므로).
-- 같은 이름은 unique 제약이 23505로 거부한다 (BR-18).
-- 상태 컬럼을 써야 해서 security definer로 만들고, 대상은 auth.uid() 본인으로 고정한다 (6.2).
-- ---------------------------------------------------------------
create or replace function public.add_food(
  name text,
  food_group text,
  memo text default null,
  already_tried boolean default false,
  first_tried_date date default null
)
returns public.foods
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tried boolean := coalesce(add_food.already_tried, false);
  added public.foods;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;
  if add_food.first_tried_date is not null and not tried then
    raise exception using
      errcode = '22023',
      message = '처음 먹은 날은 이미 먹어 본 음식에만 입력할 수 있습니다';
  end if;

  insert into public.foods (
    owner_id, name, food_group, memo,
    status, manual_tried, manual_first_tried_date, first_tried_date
  )
  values (
    uid, add_food.name, add_food.food_group, add_food.memo,
    case when tried then 'tried' else 'not_tried' end,
    tried, add_food.first_tried_date, add_food.first_tried_date
  )
  returning * into added;

  return added;
end;
$$;

comment on function public.add_food(text, text, text, boolean, date) is
  '음식 추가. already_tried면 먹어봄으로 저장 (FR-FOOD-04~05, BR-17). security definer (D10)';

-- ---------------------------------------------------------------
-- seed_default_foods: 기본 음식 목록(부록 B, 42개)을 아직 안 먹어봄으로 추가 (FR-FOOD-07, R16)
-- 아이 정보를 처음 등록할 때 화면이 1회 호출한다. 같은 이름(BR-18)이 이미 있으면 건너뛴다.
-- 돌려주는 값: 새로 추가한 음식 수
-- ---------------------------------------------------------------
create or replace function public.seed_default_foods()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  added integer;
begin
  if uid is null then
    raise exception using errcode = '42501', message = '로그인이 필요합니다';
  end if;

  insert into public.foods (owner_id, name, food_group, is_default)
  select uid, d.name, d.food_group, true
  from (
    values
      ('쌀', 'grain'), ('찹쌀', 'grain'), ('오트밀', 'grain'), ('보리', 'grain'),
      ('감자', 'grain'), ('고구마', 'grain'), ('밀가루', 'grain'),
      ('애호박', 'vegetable'), ('단호박', 'vegetable'), ('브로콜리', 'vegetable'),
      ('콜리플라워', 'vegetable'), ('당근', 'vegetable'), ('양배추', 'vegetable'),
      ('청경채', 'vegetable'), ('시금치', 'vegetable'), ('무', 'vegetable'),
      ('오이', 'vegetable'), ('양파', 'vegetable'), ('가지', 'vegetable'), ('버섯', 'vegetable'),
      ('사과', 'fruit'), ('배', 'fruit'), ('바나나', 'fruit'), ('아보카도', 'fruit'),
      ('블루베리', 'fruit'), ('딸기', 'fruit'), ('수박', 'fruit'), ('귤', 'fruit'),
      ('소고기', 'protein'), ('닭고기', 'protein'), ('돼지고기', 'protein'),
      ('흰살생선', 'protein'), ('연어', 'protein'), ('달걀노른자', 'protein'),
      ('달걀흰자', 'protein'),
      ('요거트', 'dairy'), ('치즈', 'dairy'), ('우유', 'dairy'),
      ('두부', 'etc'), ('김', 'etc'), ('참깨', 'etc'), ('땅콩', 'etc')
  ) as d (name, food_group)
  on conflict (owner_id, name_key) do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

comment on function public.seed_default_foods() is
  '기본 음식 목록(부록 B)을 아직 안 먹어봄으로 추가하고 추가한 수를 돌려준다. 같은 이름은 건너뜀 (FR-FOOD-07)';

-- 로그인한 사용자만 호출할 수 있다 (Supabase는 새 함수를 anon에게도 열어 두므로 뺀다)
revoke execute on function public.add_food(text, text, text, boolean, date) from public, anon;
grant execute on function public.add_food(text, text, text, boolean, date) to authenticated;
revoke execute on function public.seed_default_foods() from public, anon;
grant execute on function public.seed_default_foods() to authenticated;
