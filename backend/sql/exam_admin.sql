-- 관리자 페이지 잠금 비밀번호 저장 테이블 (1행만 사용, id=1)
-- 비번은 sha256 해시로 저장. 서버(서비스키)만 접근하고 RLS로 일반 유저 차단.
create table if not exists exam_admin (
  id            int primary key,
  password_hash text not null,
  updated_at    timestamptz default now()
);

alter table exam_admin enable row level security;
-- 정책을 만들지 않으면 anon/authenticated는 전부 거부됨.
-- 서비스 롤(백엔드)은 RLS를 우회하므로 정상 동작.

-- 최초 비번(1234rla)은 백엔드가 행이 없을 때 자동 시드하므로 별도 insert 불필요.
