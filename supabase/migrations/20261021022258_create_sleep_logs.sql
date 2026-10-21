-- T-24: 수면(sleep_logs) + 수면 검증 트리거
-- 기준: 기술요구사항서 5.2(D4, D5), 기능요구사항서 FR-SLEEP-02~08, BR-04~07
-- 시각은 시간대 없는 timestamp로 기기의 벽시계 시각을 그대로 저장한다 (D4).
-- 날짜 붙이기(BR-05)는 화면(src/domain/sleep.ts)이 하고, DB는 결과가 규칙에 맞는지만 검증한다.

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  bed_time timestamp,
  wake_time timestamp,
  -- [{"start": "2026-10-19T10:00", "end": "2026-10-19T11:20"}, ...] (D5)
  naps jsonb not null default '[]'::jsonb,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_logs_owner_date_key unique (owner_id, date),
  constraint sleep_logs_naps_is_array check (jsonb_typeof(naps) = 'array'),
  constraint sleep_logs_memo_length check (char_length(memo) <= 500)
);

comment on table public.sleep_logs is '수면 기록. 수면일(밤잠에 든 날)당 1건 (F-10, FR-SLEEP-08)';
comment on column public.sleep_logs.date is '수면일: 밤잠에 든 날 (BR-04)';
comment on column public.sleep_logs.naps is '수면일 당일 낮잠 목록 [{start, end}] (BR-06)';

create index sleep_logs_owner_date_idx on public.sleep_logs (owner_id, date desc);

-- ---------------------------------------------------------------
-- 수면 검증 (FR-SLEEP-02, 07)
-- ---------------------------------------------------------------
create or replace function public.validate_sleep_log()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  day_start timestamp := new.date::timestamp;
  nap jsonb;
  other jsonb;
  nap_start timestamp;
  nap_end timestamp;
  other_start timestamp;
  other_end timestamp;
  i int;
  j int;
  nap_count int := jsonb_array_length(new.naps);
begin
  -- 시간 항목이 하나도 없으면 저장하지 않는다
  if new.bed_time is null and new.wake_time is null and nap_count = 0 then
    raise exception using errcode = '23514', message = '잠든 시간, 일어난 시간, 낮잠 중 하나 이상 입력해야 합니다';
  end if;

  -- BR-05: 잠든 시각은 수면일 12:00 ~ 다음 날 11:59
  if new.bed_time is not null
     and (new.bed_time < day_start + interval '12 hours' or new.bed_time >= day_start + interval '36 hours') then
    raise exception using errcode = '23514', message = '잠든 시각이 수면일 기준 범위(12:00~다음 날 11:59)를 벗어났습니다';
  end if;

  -- 밤잠은 1시간 이상 16시간 이하
  if new.bed_time is not null and new.wake_time is not null
     and (new.wake_time - new.bed_time < interval '1 hour' or new.wake_time - new.bed_time > interval '16 hours') then
    raise exception using errcode = '23514', message = '밤잠은 1시간 이상 16시간 이하여야 합니다';
  end if;

  for i in 0 .. nap_count - 1 loop
    nap := new.naps -> i;
    if jsonb_typeof(nap) <> 'object' or nap ->> 'start' is null or nap ->> 'end' is null then
      raise exception using errcode = '23514', message = format('낮잠 %s: 시작과 끝이 모두 있어야 합니다', i + 1);
    end if;
    nap_start := (nap ->> 'start')::timestamp;
    nap_end := (nap ->> 'end')::timestamp;

    if nap_start::date <> new.date or nap_end::date <> new.date then
      raise exception using errcode = '23514', message = format('낮잠 %s: 수면일 당일이어야 합니다', i + 1);
    end if;
    if nap_end <= nap_start then
      raise exception using errcode = '23514', message = format('낮잠 %s: 끝이 시작보다 늦어야 합니다', i + 1);
    end if;
    if new.bed_time is not null and nap_end > new.bed_time then
      raise exception using errcode = '23514', message = format('낮잠 %s: 밤잠 시간과 겹칩니다', i + 1);
    end if;

    for j in i + 1 .. nap_count - 1 loop
      other := new.naps -> j;
      other_start := (other ->> 'start')::timestamp;
      other_end := (other ->> 'end')::timestamp;
      if other_start is not null and other_end is not null
         and nap_start < other_end and other_start < nap_end then
        raise exception using errcode = '23514', message = format('낮잠 %s, 낮잠 %s: 시간이 겹칩니다', i + 1, j + 1);
      end if;
    end loop;
  end loop;

  return new;
end;
$$;

comment on function public.validate_sleep_log() is '수면 기록 검증: 입력 유무, 잠든 시각 범위, 밤잠 길이, 낮잠 순서·겹침 (FR-SLEEP-07)';

create trigger sleep_logs_validate
  before insert or update on public.sleep_logs
  for each row execute function public.validate_sleep_log();

create trigger sleep_logs_set_updated_at
  before update on public.sleep_logs
  for each row execute function public.set_updated_at();

create trigger sleep_logs_reject_future_date
  before insert or update on public.sleep_logs
  for each row execute function public.reject_future_date('date');

create trigger sleep_logs_reject_before_birth
  before insert or update on public.sleep_logs
  for each row execute function public.reject_before_birth('date');

alter table public.sleep_logs enable row level security;

create policy "본인 데이터만 조회" on public.sleep_logs
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "본인 데이터만 추가" on public.sleep_logs
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 수정" on public.sleep_logs
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 데이터만 삭제" on public.sleep_logs
  for delete to authenticated using ((select auth.uid()) = owner_id);
