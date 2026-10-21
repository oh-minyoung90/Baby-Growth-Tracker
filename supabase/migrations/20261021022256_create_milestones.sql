-- T-18: 발달 기록(milestones)
-- 기준: 기술요구사항서 5.2, 기능요구사항서 FR-MS-01~06, BR-03

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  type text not null,
  title text not null,
  -- BR-03 "같은 내용" 비교 키. src/domain/text.ts의 toContentKey와 같은 규칙:
  -- NFC 정규화 → 앞뒤 공백 제거 → 연속 공백 하나로 → 소문자
  title_key text generated always as (
    lower(regexp_replace(btrim(normalize(title, NFC)), '\s+', ' ', 'g'))
  ) stored,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_type_check check (type in ('word', 'behavior', 'expression', 'play')),
  constraint milestones_title_length check (char_length(btrim(title)) between 1 and 30),
  constraint milestones_memo_length check (char_length(memo) <= 500)
);

comment on table public.milestones is '발달 기록: 단어·행동·표정·놀이 (F-06). 같은 내용 중복 저장은 허용 (FR-MS-06은 화면 확인)';
comment on column public.milestones.title_key is 'BR-03 같은 내용 비교 키 (자동 생성)';

create index milestones_owner_date_idx on public.milestones (owner_id, date desc);
create index milestones_owner_type_key_idx on public.milestones (owner_id, type, title_key);

create trigger milestones_set_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

create trigger milestones_reject_future_date
  before insert or update on public.milestones
  for each row execute function public.reject_future_date('date');

create trigger milestones_reject_before_birth
  before insert or update on public.milestones
  for each row execute function public.reject_before_birth('date');

alter table public.milestones enable row level security;

create policy "본인 데이터만 조회" on public.milestones
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 데이터만 추가" on public.milestones
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 수정" on public.milestones
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 삭제" on public.milestones
  for delete to authenticated using ((select auth.uid()) = owner_id);
