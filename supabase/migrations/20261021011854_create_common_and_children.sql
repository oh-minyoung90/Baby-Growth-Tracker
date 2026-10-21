-- T-08: 공통 DB 기반 + 아이 정보(children) 테이블
-- 기준: 기술요구사항서 5.1(공통 규칙), 5.2(children), 5.4(서버 날짜 검증), 6.1(RLS)

-- ---------------------------------------------------------------
-- 공통 함수 1. updated_at 자동 갱신
-- 행을 수정할 때마다 updated_at을 현재 시각으로 바꾼다.
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  '행 수정 시 updated_at을 현재 시각으로 갱신한다 (기술요구사항서 5.1)';

-- ---------------------------------------------------------------
-- 공통 함수 2. 미래 날짜 검증 (D2)
-- 서버는 기기 시간대를 모르므로 "현재 UTC 날짜 + 1일"까지만 허용한다.
-- 정확한 "오늘 이후 금지"는 화면에서 검증한다.
-- 사용법: 트리거 인자로 검사할 date 컬럼 이름을 넘긴다.
--   create trigger ... execute function public.reject_future_date('birth_date');
-- ---------------------------------------------------------------
create or replace function public.reject_future_date()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  column_name text := tg_argv[0];
  value date;
begin
  value := (to_jsonb(new) ->> column_name)::date;
  if value is not null and value > (now() at time zone 'utc')::date + 1 then
    raise exception using
      errcode = '22007',
      message = format('%s는 오늘 이후 날짜일 수 없습니다', column_name);
  end if;
  return new;
end;
$$;

comment on function public.reject_future_date() is
  '지정한 date 컬럼이 현재 UTC 날짜 + 1일을 넘으면 거부한다 (기술요구사항서 5.4, D2)';

-- ---------------------------------------------------------------
-- children: 아이 정보 (F-01). 계정당 1건 (FR-CHILD-04)
-- ---------------------------------------------------------------
create table public.children (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null,
  birth_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_owner_id_key unique (owner_id),
  constraint children_nickname_length check (char_length(btrim(nickname)) between 1 and 20)
);

comment on table public.children is '아이 정보. 계정당 1건 (F-01, FR-CHILD-04)';

create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

create trigger children_reject_future_birth_date
  before insert or update on public.children
  for each row execute function public.reject_future_date('birth_date');

-- ---------------------------------------------------------------
-- RLS: 본인 데이터만 조회·추가·수정·삭제 (기술요구사항서 6.1)
-- 로그인하지 않은 요청(anon)에는 정책을 주지 않으므로 모두 거부된다.
-- auth.uid()를 select로 감싸 행마다 다시 계산하지 않게 한다 (Supabase 권장 방식).
-- ---------------------------------------------------------------
alter table public.children enable row level security;

create policy "본인 데이터만 조회" on public.children
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "본인 데이터만 추가" on public.children
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "본인 데이터만 수정" on public.children
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "본인 데이터만 삭제" on public.children
  for delete to authenticated
  using ((select auth.uid()) = owner_id);
