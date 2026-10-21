-- T-15: 키·몸무게(body_measures) + 생년월일 이전 날짜 거부 공통 함수
-- 기준: 기술요구사항서 5.2, 기능요구사항서 FR-BODY-01~02, BR-02

-- ---------------------------------------------------------------
-- 공통 함수 3. 생년월일 이전 날짜 거부 (BR-02)
-- 기록한 사용자의 children.birth_date보다 이른 날짜를 거부한다.
-- 아이 정보가 아직 없으면 검사하지 않는다 (화면에서는 아이 정보 등록이 먼저다).
-- 사용법: execute function public.reject_before_birth('date');
-- ---------------------------------------------------------------
create or replace function public.reject_before_birth()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  column_name text := tg_argv[0];
  value date;
  birth date;
begin
  value := (to_jsonb(new) ->> column_name)::date;
  select c.birth_date into birth from public.children c where c.owner_id = new.owner_id;
  if value is not null and birth is not null and value < birth then
    raise exception using
      errcode = '22007',
      message = format('%s는 생년월일(%s)보다 이를 수 없습니다', column_name, birth);
  end if;
  return new;
end;
$$;

comment on function public.reject_before_birth() is
  '지정한 date 컬럼이 기록한 사용자의 아이 생년월일보다 이르면 거부한다 (BR-02)';

-- ---------------------------------------------------------------
-- body_measures: 키·몸무게 (F-05)
-- ---------------------------------------------------------------
create table public.body_measures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  height_cm numeric(4, 1),
  weight_kg numeric(3, 1),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_measures_height_range check (height_cm between 30 and 150),
  constraint body_measures_weight_range check (weight_kg between 1 and 50),
  constraint body_measures_height_or_weight check (height_cm is not null or weight_kg is not null),
  constraint body_measures_memo_length check (char_length(memo) <= 500)
);

comment on table public.body_measures is '키·몸무게 측정 (F-05). 같은 날짜 중복은 허용 (FR-BODY-06은 화면 안내)';

create index body_measures_owner_date_idx on public.body_measures (owner_id, date desc);

create trigger body_measures_set_updated_at
  before update on public.body_measures
  for each row execute function public.set_updated_at();

create trigger body_measures_reject_future_date
  before insert or update on public.body_measures
  for each row execute function public.reject_future_date('date');

create trigger body_measures_reject_before_birth
  before insert or update on public.body_measures
  for each row execute function public.reject_before_birth('date');

alter table public.body_measures enable row level security;

create policy "본인 데이터만 조회" on public.body_measures
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 데이터만 추가" on public.body_measures
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 수정" on public.body_measures
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 삭제" on public.body_measures
  for delete to authenticated using ((select auth.uid()) = owner_id);
