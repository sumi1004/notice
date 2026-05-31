-- Supabase SQL Editor에 붙여넣고 실행하세요.
-- 신청자 명단 테이블
create table if not exists applications (
  id          bigint generated always as identity primary key,
  created_at  timestamptz default now(),
  name        text not null,
  phone       text,
  email       text not null,
  source      text default 'web',
  mail_sent   boolean default false
);

-- 이메일 기준 중복 신청 방지(원하면 주석 해제)
-- create unique index if not exists uniq_applications_email on applications (email);
