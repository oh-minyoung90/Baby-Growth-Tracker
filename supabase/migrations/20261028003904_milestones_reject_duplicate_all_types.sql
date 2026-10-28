-- T-22: 같은 내용은 유형과 관계없이 다시 저장하지 않는다
-- 기준: 기능요구사항서 FR-MS-06, R41 (2026-10-28 변경: 단어만 저장 안 함 → 단어·행동·표정·놀이 모두 저장 안 함)
-- 바로 앞 마이그레이션(20261028000135)의 단어 전용 트리거를 모든 유형으로 넓힌다.
-- 같은 유형에 같은 title_key가 있으면 23505(unique_violation)로 거부한다.
-- unique 인덱스 대신 트리거, BEFORE 대신 AFTER 트리거를 쓰는 이유는 앞 마이그레이션과 같다
-- (변경 전에 저장된 같은 내용의 날짜·메모 수정 허용, 생성 컬럼 title_key 사용).

drop trigger milestones_reject_duplicate_word on public.milestones;
drop function public.reject_duplicate_word();

create or replace function public.reject_duplicate_milestone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 수정할 때 유형·내용을 바꾸지 않았으면 검사하지 않는다
  if tg_op = 'UPDATE' and old.type = new.type and old.title_key = new.title_key then
    return null;
  end if;
  if exists (
    select 1 from public.milestones
    where owner_id = new.owner_id
      and type = new.type
      and title_key = new.title_key
      and id <> new.id
  ) then
    raise exception using errcode = '23505', message = '같은 유형에 같은 내용이 이미 있습니다';
  end if;
  return null;
end;
$$;

comment on function public.reject_duplicate_milestone() is
  '같은 계정·같은 유형에 같은 내용(BR-03 title_key)이 있으면 거부한다 (FR-MS-06)';

create trigger milestones_reject_duplicate
  after insert or update on public.milestones
  for each row execute function public.reject_duplicate_milestone();

comment on table public.milestones is
  '발달 기록: 단어·행동·표정·놀이 (F-06). 같은 유형에 같은 내용은 저장 불가 (FR-MS-06, 트리거)';
