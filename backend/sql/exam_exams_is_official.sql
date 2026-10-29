-- 회차 구분: 실제 기출(true) / 예상문제(false)
-- 단어장 '기출 N회' 등 실제 기출만 다뤄야 하는 곳에서 source_file 이름 규칙 대신 사용
alter table exam_exams
  add column if not exists is_official boolean not null default true;

-- 기존 예상문제 회차 (AI예상문제_*, psat형_국어_예상문제_* 등)
update exam_exams set is_official = false where source_file like '%예상문제%';
