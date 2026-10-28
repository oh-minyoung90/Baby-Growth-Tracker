-- T-22: 같은 단어는 다시 저장하지 않는다
-- 기준: 기능요구사항서 FR-MS-06, R41 (2026-10-28 변경: 단어도 확인 후 저장 허용 → 저장 안 함)
-- 행동·표정·놀이는 지금처럼 같은 내용도 저장할 수 있다 ("그래도 저장").
-- 같은 단어가 있으면 23505(unique_violation)로 거부한다.
--
-- unique 인덱스 대신 트리거로 검사하는 이유:
--   변경 전에 저장된 같은 단어가 남아 있을 수 있고, 그 기록의 날짜·메모 수정은 막지 않기 위함이다
--   (화면도 유형·내용을 바꾸지 않은 수정은 다시 묻지 않는다).
-- title_key는 생성 컬럼이라 BEFORE 트리거에서 읽을 수 없어 AFTER 트리거로 검사한다.
-- 두 기기에서 같은 단어를 동시에 저장하는 경우까지는 막지 않는다 (개인용 앱).

create or replace function public.reject_duplicate_word()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type <> 'word' then
    return null;
  end if;
  -- 수정할 때 유형·내용을 바꾸지 않았으면 검사하지 않는다
  if tg_op = 'UPDATE' and old.type = new.type and old.title_key = new.title_key then
    return null;
  end if;
  if exists (
    select 1 from public.milestones
    where owner_id = new.owner_id
      and type = 'word'
      and title_key = new.title_key
      and id <> new.id
  ) then
    raise exception using errcode = '23505', message = '이미 기록한 단어입니다';
  end if;
  return null;
end;
$$;

comment on function public.reject_duplicate_word() is
  '같은 계정에 같은 단어(BR-03 title_key)가 있으면 거부한다 (FR-MS-06)';

create trigger milestones_reject_duplicate_word
  after insert or update on public.milestones
  for each row execute function public.reject_duplicate_word();

comment on table public.milestones is
  '발달 기록: 단어·행동·표정·놀이 (F-06). 같은 단어는 저장 불가(트리거), 그 밖의 유형은 같은 내용도 저장 가능 (FR-MS-06)';
