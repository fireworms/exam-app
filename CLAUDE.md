# exam-app

공무원 시험 문제 풀기 웹앱. PDF 시험지를 AI로 파싱하거나 JSON으로 직접 가져와 DB에 저장하고, 문제 풀기/오답노트/통계 기능을 제공한다.

## 협업 규칙

- Claude는 이 프로젝트에서 **라이코스**로 불림
- 응답은 짧고 간결하게
- **서비스 제공자(Supabase, Firebase 등)가 공식 라이브러리를 제공하면 직접 구현보다 해당 라이브러리를 최우선 활용한다** — 세션 관리, 인증 등 플랫폼 의존적 기능은 특히 그렇다

---

## 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | FastAPI (Python 3.12) + supabase-py 2.30.0 |
| DB | Supabase PostgreSQL (`exam_*` 접두어 테이블) |
| 프론트엔드 | React + Vite (JSX, CSS-in-JS + `<style>` 태그) |
| AI 파서 | Gemini `gemini-2.0-flash-preview`, Claude `claude-sonnet-4-6` |
| 인증 | Supabase Auth (email/password, JWT Bearer) |
| 배포 | 로컬: FastAPI가 `frontend/dist` 정적 파일 서빙 (포트 8008) / 외부: Vercel (서버리스) |

---

## 실행 — 반드시 빌드 모드. `vite dev` 사용 금지.

```bash
cd /home/fireworms/exam-app/frontend && npm run build
lsof -ti:8008 | xargs kill -9 2>/dev/null
cd /home/fireworms/exam-app/backend && source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8008 > /tmp/backend.log 2>&1 &
```

접속: `http://192.168.50.102:8008` / 로그: `/tmp/backend.log`

> **로컬 백엔드는 on-demand 전용** — 프로덕션은 Vercel에서 돌고, 로컬은 필요할 때만 띄운다.
> 부팅 시 자동 시작(systemd)·상시 데몬을 두지 말 것. 과거 `exam-app.service`(systemd) 유닛이
> 부팅마다 `python main.py`를 띄우다 8008 포트 충돌(`Errno 98`)로 5초마다 크래시·재시작하며
> `reload=True` import로 CPU를 태운 적 있음 → 유닛 제거함. 다시 만들지 말 것.
> 위 `nohup uvicorn` 또는 루트의 `./exam.sh`(dev/build/stop) 런처로 수동 실행.
> `main.py` 끝의 `uvicorn.run(..., reload=True)`는 **로컬 개발 편의용**(파일 변경 자동 반영)이며 서비스/상시 구동용 아님.

환경변수 (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

---

## 주요 경로

| 경로 | 설명 |
|------|------|
| `backend/main.py` | 메인 앱 + 대부분 엔드포인트 |
| `backend/auth.py` | JWT 검증, `get_current_user` |
| `backend/db.py` | `get_supabase()`, `db_exec()` (전송 오류 재시도), `db_fetch_all()` (1000행 제한 우회 전수 조회) |
| `backend/upload_router.py` | PDF/JSON 업로드 (`/api/upload`) |
| `backend/edit_router.py` | 문제 편집/이미지 (`/api/questions`) |
| `backend/exam_ops.py` | `delete_exam_cascade()` — 회차 삭제 (엔드포인트·업로드 롤백 공용) |
| `backend/vocab_router.py` | 단어장 (`/api/vocab`) |
| `backend/exam_freq.py` | 단어장 `exam_freq` — 실제 영어 기출 등장 회차 수 (simplemma 표제어, 10분 캐시) |
| `backend/sql/` | 수동 실행 DDL (Supabase SQL Editor) |
| `backend/images/` | 문제 이미지 로컬 캐시 (레거시, 실제 서빙은 Storage) |
| `api/index.py` | Vercel 서버리스 진입점 (`backend.main:app` 로드) |
| `pyproject.toml` | Vercel entrypoint 설정 (`[tool.vercel]`) |
| `vercel.json` | Vercel 빌드·리라이트 설정 |
| `frontend/src/axios.js` | axios 인터셉터 (JWT 주입, tokenReady 대기) |
| `frontend/src/tts.js` | TTS 유틸 — `speak()`, `useSpeaking()` 훅 |
| `frontend/src/pages/` | 페이지 컴포넌트 |

---

## DB 스키마

**공유 (user_id 없음):**

```
exam_exams          시험 메타데이터
  id, year, month, day, subject, grade, region, source_file, is_official(실제 기출=true / 예상문제=false)

exam_questions      문제
  id, exam_id → exam_exams, number, question_text, question_image(Storage 공개 URL), explanation

exam_choices        선지
  id, question_id → exam_questions, number, text, is_correct

exam_upload_logs    업로드 진행 상태
  id, source_file, status(pending→processing→done|failed), error_msg, exam_id

exam_admin          관리자 비밀번호 (1행, RLS deny — 서비스키만 접근)
  id(=1), password_hash(sha256)
```

**유저별 (user_id UUID → auth.users):**

```
exam_solve_history  id, user_id, question_id, selected_choice, is_correct, time_taken, session_id
exam_wrong_notes    id, user_id, question_id UNIQUE, is_dismissed, memo, added_at
exam_scraps         id, user_id, question_id UNIQUE, memo, created_at
exam_sessions       id, user_id, mode, subject, exam_id, total_count, correct_count, skipped_count, duration
exam_settings       id, user_id, auto_remove_wrong
exam_reports        id, user_id, question_id UNIQUE(user_id,question_id), created_at
exam_vocab          id, user_id, word, type(word|phrase), pos, meaning, example, example_translation, synonyms(jsonb), is_high_freq(미사용), source_text, quiz_correct, quiz_wrong, created_at
```

---

## 인증 구조

- 백엔드: `Authorization: Bearer <jwt>` 헤더 검증 (`auth.py`)
- 프론트: axios 인터셉터 — `tokenReady` Promise로 `getSession()` 완료 후 첫 요청 송신 (새로고침 race condition 방지), 401 시 `/login` 리다이렉트
- refresh_token: Supabase `onAuthStateChange` 자동 갱신 (localStorage 저장)
- 비밀번호: 8자+, 영문+숫자 필수 (백엔드 검증)
- 비밀번호 재설정: `/reset-password` (URL 해시 access_token 파싱)

### ⚠️ Vercel 배포 관련

- **프로덕션 URL**: https://exam-app-two-nu.vercel.app
- **배포 = GitHub 자동배포** — Vercel 프로젝트가 `github.com/fireworms/exam-app`에 연동돼 있음. **코드 변경 시 커밋 후 `master`에 push하면 prod 자동 배포된다.** 수동 `vercel --prod`로 따로 배포하지 말 것 — 과거 수동 배포가 커밋보다 앞서며 변경이 누락된 적 있음.
  ```bash
  git push origin master   # → Vercel prod 자동 배포
  ```
  - 폴백(긴급/연동 장애 시에만): 반드시 루트(`/home/fireworms/exam-app`)에서 `vercel --prod --yes` — `frontend/` 안에서 실행하면 다른 프로젝트로 배포됨
  - DB 데이터 변경(문제 교체 등)은 Supabase 공유라 배포 불필요 — push 없이도 prod 즉시 반영
- **환경변수**: Vercel 대시보드 또는 `vercel env add/rm` — `SUPABASE_SERVICE_KEY`는 Supabase 대시보드의 service_role **JWT** 키 사용 (`sb_secret_` 포맷 아님)
- `api/index.py` + `pyproject.toml` — Vercel이 `backend.main:app` 로드. `upload_router`는 `VERCEL=1` 환경변수로 자동 제외
- `backend/main.py` 상단 `sys.path.insert` — Vercel에서 sibling 모듈 임포트 보장
- **`vercel.json`에 `rewrites`를 추가하지 말 것** — `pyproject.toml`의 `[tool.vercel] entrypoint`로 FastAPI 함수가 루트 전체를 담당하고, `main.py`가 이미 `/assets` StaticFiles 마운트 + SPA 캐치올을 처리한다. 과거 `/(.*) → /index.html` 캐치올이 정적 파일보다 먼저 매칭돼 JS/CSS 자리에 HTML이 반환되며 `Failed to load module script ... MIME type "text/html"` 흰 화면 발생, `/api/:path* → /api/index`도 존재하지 않는 목적지라 API 요청까지 캐치올로 흘러 HTML을 반환했음 (로컬은 정상이라 재현 안 됨). 증상 확인: `curl -sI <prod>/assets/index-*.js`의 `content-type`이 `text/html`이면 이 문제

### ⚠️ Supabase 싱글톤 주의

**`/auth/login`, `/auth/signup`은 반드시 `_new_auth_client()` 사용.**

싱글톤(`get_supabase()`)에 `sign_in_with_password` / `sign_up` 호출 시 → 내부 `_listen_to_auth_events`가 PostgREST Authorization 헤더를 서비스키→유저JWT로 교체 → 이후 모든 DB 쿼리 RLS 적용으로 빈 배열 반환.

- 데이터 조회/수정: `get_supabase()`
- auth 엔드포인트: `_new_auth_client()`

---

## 이미지 처리

- 저장 위치: Supabase Storage 버킷 `question-images` (public)
- DB 컬럼: `question_image` — Storage 공개 URL 문자열
- 서빙: `<img src={q.question_image} />` 직접 사용 (API 프록시 없음)
- `GET /api/questions/{id}/image` — Storage URL로 302 리다이렉트 (레거시 호환)
- `edit_router.py`: 업로드/삭제 모두 `sb.storage.from_("question-images")` 사용

---

## API 라우팅 구조

- **모든 API 엔드포인트는 `/api` 접두어** — `api_router = APIRouter()`로 묶어 `app.include_router(api_router, prefix="/api")`
- upload_router, edit_router도 `/api/upload`, `/api/questions`로 마운트
- 프론트 `src/api.js`의 기본 base URL: `/api`
- SPA 캐치올(`/{full_path:path}`)은 `@app.get`으로 별도 등록 — API 라우터와 분리되어 페이지 새로고침 정상 작동
- 캐치올에서 `full_path.startswith("api/")` 이면 404 반환 — 미등록 API 경로가 HTML을 반환하는 버그 방지
- `index.html` 반환 시 `Cache-Control: no-cache` 헤더 설정 — 재배포 후 구 asset 해시 참조 방지

---

## 엔드포인트

### main.py (`/api`)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/auth/signup` | 회원가입 |
| `POST /api/auth/login` | 로그인 → access_token + refresh_token |
| `POST /api/auth/refresh` | 토큰 갱신 |
| `POST /api/auth/forgot-password` | 비밀번호 재설정 메일 |
| `POST /api/auth/update-password` | 비밀번호 변경 |
| `GET /api/auth/me` | 현재 유저 정보 |
| `GET /api/subjects` | 과목별 문제 수 |
| `GET /api/questions` | 문제 목록 (exam_id 필터) |
| `GET /api/questions/random` | 랜덤 문제 (count, subject, source, exam_ids) |
| `GET /api/questions/exam-mode` | 시험 모드용 문제 (과목 목록, random/by_exam) |
| `GET /api/questions/by_ids` | ID 배열로 문제 조회 |
| `GET /api/questions/deeplink` | 딥링크용 단일 문제 |
| `GET /api/questions/{id}` | 단일 문제 |
| `POST /api/solve` | 답안 제출 → 정답 확인, 오답노트 처리, 오답 시 누적 `wrong_count` 반환 |
| `POST /api/solve/batch` | 답안 일괄 제출 (시험 모드) — 한 요청으로 채점·기록, 오답별 `wrong_count` 포함 |
| `GET /api/wrong-notes` | 오답노트 목록 |
| `DELETE /api/wrong-notes/{question_id}` | 오답노트 제거 |
| `PUT /api/wrong-notes/{question_id}/memo` | 오답노트 메모 수정 |
| `GET /api/scraps` | 스크랩 목록 |
| `GET /api/scraps/ids` | 스크랩 question_id만 (Quiz 별표 표시용 경량 조회) |
| `POST /api/scraps/{question_id}` | 스크랩 추가 |
| `DELETE /api/scraps/{question_id}` | 스크랩 삭제 |
| `POST /api/reports/{question_id}` | 문제 신고 |
| `DELETE /api/reports/{question_id}` | 신고 취소 |
| `GET /api/reports` | 전체 신고 목록 (관리자용) |
| `POST /api/admin/verify` | 관리자 비밀번호 검증 |
| `POST /api/admin/password` | 관리자 비밀번호 변경 |
| `GET/PUT /api/settings` | 설정 조회/수정 |
| `GET /api/exams` | 시험 목록 |
| `DELETE /api/exams/{exam_id}` | 시험 삭제 |
| `POST /api/sessions` | 세션 시작 |
| `PUT /api/sessions/{id}/end` | 세션 종료 |
| `GET /api/sessions/{id}/detail` | 풀이 회차 리뷰 — 세션 정보 + 문제별 풀이 결과 |
| `GET /api/stats/counts` | 문제 수 카운트 (홈 로딩용) |
| `GET /api/stats/overview` | 통계 (전체, 과목별, 날짜별) |
| `GET /api/stats/wrong-counts` | 많이 틀린 문제 목록 (limit=30) |

### upload_router.py (`/api/upload`)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/upload/analyze` | PDF 업로드 → 파일명 파싱 → 중복 검사 → 임시 저장 |
| `POST /api/upload/confirm` | 파싱 시작 (백그라운드 스레드) |
| `POST /api/upload/json` | JSON 직접 임포트 |
| `GET /api/upload/logs` | 업로드 로그 최근 100건 |

### vocab_router.py (`/api/vocab`)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/vocab/analyze` | 선택 텍스트 Gemini 분석 → 단어 정보 + root_data 반환 |
| `POST /api/vocab` | 단어 저장 (upsert) — root_data 있으면 원형도 함께 저장 |
| `GET /api/vocab` | 단어 목록 (after 파라미터로 증분 fetch 지원) — 각 행에 `exam_freq` 부착 |
| `POST /api/vocab/{id}/quiz` | 미니 퀴즈 결과 기록 (`exam_vocab_quiz_record` RPC로 원자적 증가) |
| `DELETE /api/vocab/{id}` | 단어 삭제 |

### edit_router.py (`/api/questions`)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /api/questions/{id}/image` | 이미지 업로드 |
| `GET /api/questions/{id}/image` | 이미지 서빙 |
| `DELETE /api/questions/{id}/image` | 이미지 삭제 |
| `PUT /api/questions/{id}` | 문제 텍스트/선지/해설 수정 |

---

## 프론트엔드 페이지

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/login` | Login | 로그인 / 회원가입 / 비밀번호 찾기 |
| `/reset-password` | ResetPassword | 비밀번호 재설정 |
| `/` | Home | 시험 모드 선택, 과목·회차 선택 |
| `/quiz` | Quiz | 문제 풀기 (랜덤/오답/스크랩/시험 모드) |
| `/wrong-notes` | WrongNotes | 오답노트 목록 + 메모 |
| `/scraps` | Scraps | 스크랩 목록 |
| `/stats` | Stats | 통계 + 많이 틀린 문제 — 세션 행 클릭 시 리뷰 진입 |
| `/session/:session_id` | SessionReview | 풀이 회차 리뷰 (목록↔상세, 오답만 토글). 시험 직후엔 state로 받아 fetch 없이 표시 |
| `/admin` | Admin | 관리자 페이지 (비밀번호 게이트) — 업로드/로그/회차관리/신고 탭 |
| `/edit/:question_id` | EditQuestion | 문제/이미지 수정 |
| `/vocab` | Vocab | 단어장 목록 (품사·기출 N회+ 필터, 최신/알파벳/기출/오답률/정답률 정렬, 뜻 가리기, 4지선다 미니 퀴즈 — URL 파라미터 유지) |
| `/settings` | Settings | auto_remove_wrong 설정 |
| `/upload`, `/logs` | — | `/admin`으로 리다이렉트 |

메뉴: 홈 / 오답노트 / 스크랩 / 통계 / 설정 / 🔐 관리자  
CSS 변수: `--bg`, `--bg2`, `--bg3`, `--border`, `--text`, `--text2`, `--accent`, `--correct`, `--wrong`, `--scrap`  
PC(768px+): `body { zoom: 1.25 }`

### 관리자 페이지 (`/admin`)

- 비밀번호는 DB `exam_admin` 테이블에 sha256 해시로 1행 저장 (서비스키만 접근, RLS deny) — 프론트 번들에 평문 없음
- 검증: `POST /api/admin/verify` / 변경: `POST /api/admin/password` (현재 비번 확인 후, 4자 이상) — 관리자 탭 내 비번 변경 UI 제공
- `exam_admin` 행이 없으면 env `ADMIN_PW_INIT`으로 최초 시드 — 미설정이거나 조회 실패 시 503 (기본 비번으로 열어주지 않음, 코드에 평문 비번 두지 말 것)
- sessionStorage `_adm` 키로 세션 내 잠금 유지, 로그아웃 시 해제
- 신고 목록: 모든 유저의 신고 표시, 편집/해제 버튼 제공
- **업로드·로그 탭**: `localhost`, `127.0.0.1`, `192.168.50.102` 접속 시에만 표시 (Vercel 외부 접근 시 숨김)

---

## PDF 업로드 흐름

```
1. /api/upload/analyze  — 파일명 파싱, 중복 검사, 임시 저장 (backend/pdfs/temp/)
2. 사용자 메타데이터 확인
3. /api/upload/confirm  — 백그라운드 파싱 시작
4. background_parse()
   ├─ Gemini: 순차 처리, 15초 간격, 지수 백오프 재시도
   ├─ Claude: 병렬 스레드, PDF→페이지별 PNG(2x)→base64
   ├─ save_to_db() → _resolve_shared_passages() → exam_exams + exam_questions + exam_choices 삽입
   └─ upload_logs → 'done', 임시 파일 삭제
```

### 공통지문 처리 (`_resolve_shared_passages`)

AI 파서가 공통지문 문제를 `(N번 공통지문 문제)` 형태로 마킹할 때, `save_to_db` 진입 시 자동으로 N번 문제의 지문을 삽입한다. JSON 직접 임포트에도 동일하게 적용.

---

## 기타

- **인증 없을 때 응답**: `auth.py`에서 `Header(None)` 사용 — 헤더 없으면 422 아닌 401 반환
- **Claude 파서(`parse_with_claude`)는 스트리밍 필수** — `max_tokens=64000`. 문제 수·해설이 많으면 16k 토큰을 넘겨 응답 JSON이 잘리고 `Unterminated string` 에러가 남. sonnet-4-6은 128K 출력을 지원하지만 ~16K 초과 시 non-streaming은 HTTP 타임아웃에 걸리므로 `messages.stream()` + `get_final_message()` 사용. `stop_reason == "max_tokens"`면 잘린 JSON 파싱 대신 명시적 에러
- **파싱 실패 시 임시 PDF는 삭제하지 않음** — `background_parse`의 except 절에서 지우면 재업로드 없이는 재시도 불가. 성공 시에만 삭제
- **파싱은 daemon 스레드** — 백엔드 프로세스가 죽으면 같이 사라지고 로그가 `processing`에 영구히 멈춤. 장시간 파싱은 서버와 분리된 프로세스로 돌릴 것
- **DB 호출은 `db_exec()`로 감쌀 것** — 싱글톤이 들고 있던 유휴 keep-alive 커넥션을 Supabase가 먼저 끊으면 재사용 시 `httpx.RemoteProtocolError: Server disconnected`가 난다. postgrest 내장 재시도는 GET/HEAD가 503/520 **응답**을 받은 경우만 다뤄 이 전송 계층 오류를 못 잡는다. `db.py`에서 `keepalive_expiry=5초`로 유휴 커넥션 재사용을 막고, `db_exec()`가 `httpx.TransportError`를 지수 백오프로 재시도한다
- **`save_to_db`는 일괄 삽입** — 문제마다 왕복하면 60문제에 121번이라 중간에 끊길 때 반쪽 회차가 남았다. 문제 1회 + 선지 1회로 묶고, 반환 순서 대신 `number`로 선지를 매핑한다. `background_parse`는 저장 중 실패 시 `delete_exam_cascade()`로 롤백하되 저장 성공 후 뒷정리 실패와는 경로를 분리한다
- **1000행을 넘길 수 있는 조회는 `db_fetch_all()`로 감쌀 것** — PostgREST는 서버 설정(`db-max-rows=1000`)으로 `.range()` 없는 단발 조회를 1000행에서 **에러 없이 조용히** 자른다. 테이블이 커지는 순간부터 소리 없이 틀린 값이 나온다. 과거 `/api/subjects`·`/api/exams`가 각각 물려 개별 while 루프로 땜질했으나 나머지 6곳이 남아 있었고, `exam_questions`가 1240행이 되자 `GET /api/questions`에서 지게차 3회차가 통째로 누락되고 `/api/stats/overview` 통계가 틀어졌다. `db_fetch_all(lambda: sb.table("x").select("y"))` — 인자는 **매번 새 쿼리를 만드는 팩토리**여야 한다. 같은 빌더에 `range()`를 반복하면 `offset`/`limit` 파라미터가 누적된다
- **`exam_solve_history.is_correct`는 integer 컬럼** — supabase-py `.eq("is_correct", False)`는 postgrest 22P02 에러(invalid input for integer). 반드시 `0`/`1`로 비교할 것
- 누적 오답 횟수(`wrong_count`): `_wrong_counts()` 헬퍼 — solve 응답·오답노트·세션 리뷰에 표시 ("N회 틀림" 뱃지는 `QuestionCard`)
- 학습자료: 별도 앱으로 분리됨 — 이 앱에 없음
- 홈 성능: 전체 문제 fetch 대신 `/api/stats/counts` count only 사용
- 선지 선택: 클라이언트 즉시 판정 후 `/api/solve` 백그라운드 전송
- 시험 모드 제출: 클라이언트 즉시 채점 → 결과 바로 표시, 기록은 `/api/solve/batch` 한 번으로 백그라운드 저장 (문제별 순차 요청 금지 — 서버리스 왕복 N번이라 수십 초 걸림)
- 공용 컴포넌트: `components/QuestionCard.jsx`(문제+선지 하이라이트 카드 — 오답노트·스크랩·세션리뷰), `components/SelectOrInput.jsx`(목록 선택+직접입력 겸용 필드 — 업로드 폼 과목·등급·지역), `utils/format.js`(formatDuration·accColor·sessionLabel 등 — Stats·SessionReview)
- 업로드 폼 과목·등급·지역은 고정 목록이 아님 — `SelectOrInput`의 `✏️ 직접입력`으로 새 값 등록 가능. 과목은 `/api/subjects`로 DB 등록분을 목록에 자동 병합(등급·지역은 전용 경량 엔드포인트가 없어 정적 목록만)
- 문제 풀기: 다음 문제 이동 및 로딩 완료 시 `window.scrollTo(0, 0)` 적용
- Quiz 신고 버튼: 🚩 버튼 → `POST /api/reports/{id}`, 중복 신고 무시
- 랜덤 문제: DB 조회 후 `random.shuffle()` 적용 — 미적용 시 ID 순(연도순) 정렬됨
- 토큰 갱신(`/api/auth/refresh`) 에러 구분: 네트워크 오류 → 503(로그아웃 안 함), 실제 토큰 만료/무효 → 401(로그아웃)
- 단어장 모드: Quiz에서 드래그 → Gemini 분석 → 모달 확인 후 저장. 파생어면 원형(`root_data`)도 함께 분석·표시·저장
- **단어장 '기출 N회'**: AI 고빈도 판정(`is_high_freq`)은 거의 전부 true라 폐기. `exam_freq.py`가 `is_official=true`인 영어 회차의 지문·선지를 표제어로 묶어 **회차 수**를 센다 (공통지문 복제 때문에 문제 수 아님). 저장 안 하고 조회 시 계산 → 회차 추가/삭제 자동 반영. 기출/예상문제 구분은 파일명이 아니라 `is_official` 컬럼 — 업로드 폼에서 선택 (PDF 기본 기출, JSON 기본 예상문제)
- **새 Python 의존성은 `pyproject.toml`에 반드시 추가** — Vercel은 pyproject dependencies로 설치한다. requirements.txt에만 넣으면 prod가 import 단계에서 죽어 전 경로 500 (`FUNCTION_INVOCATION_FAILED`)
- 단어장 미니 퀴즈(`components/VocabQuiz.jsx`, `utils/vocabQuiz.js`): 현재 필터 범위에서 무한 출제, 오답·미풀이 단어 가중. 오답 선지는 단어장 다른 단어 뜻(같은 품사 우선)
- 단어장 목록: 초기 1회 fetch 후 필터·정렬은 클라이언트 `useMemo` 처리. 다른 탭 저장 감지는 `BroadcastChannel('vocab_update')`
- TTS(`tts.js`): 한글/영어 구간 분리 후 각각 ko-KR·en-US로 큐 읽기. `__밑줄__` 마크업·3개 이상 언더스코어·원문자 전처리 제거
