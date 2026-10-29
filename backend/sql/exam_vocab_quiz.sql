-- 단어장 미니 퀴즈 정답/오답 누적 카운트
alter table exam_vocab
  add column if not exists quiz_correct int not null default 0,
  add column if not exists quiz_wrong   int not null default 0;

-- 원자적 증가 (읽고-쓰기 race 방지). 본인 단어만 갱신.
create or replace function exam_vocab_quiz_record(p_id bigint, p_user uuid, p_correct boolean)
returns table (quiz_correct int, quiz_wrong int)
language sql
as $$
  update exam_vocab v
     set quiz_correct = v.quiz_correct + case when p_correct then 1 else 0 end,
         quiz_wrong   = v.quiz_wrong   + case when p_correct then 0 else 1 end
   where v.id = p_id and v.user_id = p_user
  returning v.quiz_correct, v.quiz_wrong;
$$;

-- 백엔드(서비스 롤)만 호출 — 클라이언트가 p_user를 위조해 직접 부르지 못하게
revoke execute on function exam_vocab_quiz_record(bigint, uuid, boolean) from public, anon, authenticated;
