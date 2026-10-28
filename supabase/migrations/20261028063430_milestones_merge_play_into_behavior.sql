-- T-52: 놀이를 행동에 합친다 (기능요구사항서 R42)
-- 기준: 기술요구사항서 5.2
-- 기존 놀이 기록은 행동으로 바꾸고, 유형 제약에서 play를 뺀다.
-- 같은 내용의 행동 기록이 이미 있어도 둘 다 남긴다 (화면의 유형별 개수는 1개로 센다, R28).
-- 이미 저장된 기록의 유형만 바꾸므로 이 변경 동안만 검사 트리거(같은 내용, 날짜 범위)를 끈다.

alter table public.milestones disable trigger milestones_reject_duplicate;
alter table public.milestones disable trigger milestones_reject_future_date;
alter table public.milestones disable trigger milestones_reject_before_birth;

update public.milestones set type = 'behavior' where type = 'play';

alter table public.milestones enable trigger milestones_reject_duplicate;
alter table public.milestones enable trigger milestones_reject_future_date;
alter table public.milestones enable trigger milestones_reject_before_birth;

alter table public.milestones drop constraint milestones_type_check;
alter table public.milestones
  add constraint milestones_type_check check (type in ('word', 'behavior', 'expression'));

comment on table public.milestones is
  '발달 기록: 단어·행동·표정 (F-06, 놀이는 행동에 포함 R42). 같은 유형에 같은 내용은 저장 불가 (FR-MS-06, 트리거)';
