# exam-app

공무원 시험 문제 풀기 웹앱. PDF 시험지를 AI로 파싱하거나 JSON으로 직접 가져와 DB에 저장하고, 문제 풀기/오답노트/통계 기능을 제공한다.

## 협업 규칙

- Claude는 이 프로젝트에서 **라이코스**로 불림
- 응답은 짧고 간결하게

---

## 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | FastAPI (Python 3.12) + supabase-py 2.30.0 |
| DB | Supabase PostgreSQL (`exam_*` 접두어 테이블) |
| 프론트엔드 | React + Vite (JSX, CSS-in-JS + `<style>` 태그) |
| AI 파서 | Gemini `gemini-2.0-flash-preview`, Claude `claude-sonnet-4-6` |
| 인증 | Supabase Auth (email/password, JWT Bearer) |
| 배포 | FastAPI가 `frontend/dist` 정적 파일 서빙 (포트 8008) |

---

## 실행 — 반드시 빌드 모드. `vite dev` 사용 금지.

```bash
cd /home/fireworms/exam-app/frontend && npm run build
lsof -ti:8008 | xargs kill -9 2>/dev/null
cd /home/fireworms/exam-app/backend && source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8008 > /tmp/backend.log 2>&1 &
```

접속: `http://192.168.50.102:8008` / 로그: `/tmp/backend.log`

환경변수 (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

---

## 주요 경로

| 경로 | 설명 |
|------|------|
| `backend/main.py` | 메인 앱 + 대부분 엔드포인트 |
| `backend/auth.py` | JWT 검증, `get_current_user` |
| `backend/db.py` | `get_supabase()`, `_new_auth_client()` |
| `backend/upload_router.py` | PDF/JSON 업로드 (`/upload`) |
| `backend/edit_router.py` | 문제 편집/이미지 (`/questions`) |
| `backend/images/` | 문제 이미지 파일 (`q_{id}.jpg`) |
| `frontend/src/axios.js` | axios 인터셉터 (JWT 주입, refresh) |
| `frontend/src/pages/` | 페이지 컴포넌트 |

---

## DB 스키마

**공유 (user_id 없음):**

```
exam_exams          시험 메타데이터
  id, year, month, day, subject, grade, region, source_file

exam_questions      문제
  id, exam_id → exam_exams, number, question_text, question_image(절대경로 문자열), explanation

exam_choices        선지
  id, question_id → exam_questions, number, text, is_correct

exam_upload_logs    업로드 진행 상태
  id, source_file, status(pending→processing→done|failed), error_msg, exam_id
```

**유저별 (user_id UUID → auth.users):**

```
exam_solve_history  id, user_id, question_id, selected_choice, is_correct, time_taken, session_id
exam_wrong_notes    id, user_id, question_id UNIQUE, is_dismissed, memo, added_at
exam_scraps         id, user_id, question_id UNIQUE, memo, created_at
exam_sessions       id, user_id, mode, subject, exam_id, total_count, correct_count, skipped_count, duration
exam_settings       id, user_id, auto_remove_wrong
```

---

## 인증 구조

- 백엔드: `Authorization: Bearer <jwt>` 헤더 검증 (`auth.py`)
- 프론트: axios 인터셉터 자동 주입, 401 시 refresh_token으로 갱신 후 재시도, 갱신 실패 시만 `/login` 리다이렉트
- refresh_token: localStorage `exam_refresh_token`, 60일 만료 (사용 시 rotation)
- 비밀번호: 8자+, 영문+숫자 필수 (백엔드 검증)
- 비밀번호 재설정: `/reset-password` (URL 해시 access_token 파싱)

### ⚠️ Supabase 싱글톤 주의

**`/auth/login`, `/auth/signup`은 반드시 `_new_auth_client()` 사용.**

싱글톤(`get_supabase()`)에 `sign_in_with_password` / `sign_up` 호출 시 → 내부 `_listen_to_auth_events`가 PostgREST Authorization 헤더를 서비스키→유저JWT로 교체 → 이후 모든 DB 쿼리 RLS 적용으로 빈 배열 반환.

- 데이터 조회/수정: `get_supabase()`
- auth 엔드포인트: `_new_auth_client()`

---

## 이미지 처리

- 저장 위치: `backend/images/q_{question_id}.jpg`
- DB 컬럼: `question_image` — 절대경로 문자열
- 서빙: `GET /questions/{id}/image`
- `edit_router.py`의 `_resolve_path()` 헬퍼가 구형 Windows 백슬래시 경로도 처리

---

## 엔드포인트

### main.py

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /auth/signup` | 회원가입 |
| `POST /auth/login` | 로그인 → access_token + refresh_token |
| `POST /auth/refresh` | 토큰 갱신 |
| `POST /auth/forgot-password` | 비밀번호 재설정 메일 |
| `POST /auth/update-password` | 비밀번호 변경 |
| `GET /auth/me` | 현재 유저 정보 |
| `GET /subjects` | 과목별 문제 수 |
| `GET /questions` | 문제 목록 (exam_id 필터) |
| `GET /questions/random` | 랜덤 문제 (count, subject, source, exam_ids) |
| `GET /questions/exam-mode` | 시험 모드용 문제 (과목 목록, random/by_exam) |
| `GET /questions/by_ids` | ID 배열로 문제 조회 |
| `GET /questions/deeplink` | 딥링크용 단일 문제 |
| `GET /questions/{id}` | 단일 문제 |
| `POST /solve` | 답안 제출 → 정답 확인, 오답노트 처리 |
| `GET /wrong-notes` | 오답노트 목록 |
| `DELETE /wrong-notes/{question_id}` | 오답노트 제거 |
| `PUT /wrong-notes/{question_id}/memo` | 오답노트 메모 수정 |
| `GET /scraps` | 스크랩 목록 |
| `POST /scraps/{question_id}` | 스크랩 추가 |
| `DELETE /scraps/{question_id}` | 스크랩 삭제 |
| `GET/PUT /settings` | 설정 조회/수정 |
| `GET /exams` | 시험 목록 |
| `DELETE /exams/{exam_id}` | 시험 삭제 |
| `POST /sessions` | 세션 시작 |
| `PUT /sessions/{id}/end` | 세션 종료 |
| `GET /stats/counts` | 문제 수 카운트 (홈 로딩용, ~200ms) |
| `GET /stats/overview` | 통계 (전체, 과목별, 날짜별) |

### upload_router.py (`/upload`)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /upload/analyze` | PDF 업로드 → 파일명 파싱 → 중복 검사 → 임시 저장 |
| `POST /upload/confirm` | 파싱 시작 (백그라운드 스레드) |
| `POST /upload/json` | JSON 직접 임포트 |
| `GET /upload/logs` | 업로드 로그 최근 100건 |

### edit_router.py (`/questions`)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /questions/{id}/image` | 이미지 업로드 |
| `GET /questions/{id}/image` | 이미지 서빙 |
| `DELETE /questions/{id}/image` | 이미지 삭제 |
| `PUT /questions/{id}` | 문제 텍스트/선지/해설 수정 |

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
| `/stats` | Stats | 통계 |
| `/upload` | UploadPage | PDF 업로드 + JSON 가져오기 |
| `/logs` | LogsPage | 업로드 진행 상태 |
| `/edit/:question_id` | EditQuestion | 문제/이미지 수정 |
| `/settings` | Settings | auto_remove_wrong 설정 |

CSS 변수: `--bg`, `--bg2`, `--bg3`, `--border`, `--text`, `--text2`, `--accent`, `--correct`, `--wrong`, `--scrap`  
PC(768px+): `body { zoom: 1.25 }`

---

## PDF 업로드 흐름

```
1. /upload/analyze  — 파일명 파싱, 중복 검사, 임시 저장 (backend/pdfs/temp/)
2. 사용자 메타데이터 확인
3. /upload/confirm  — 백그라운드 파싱 시작
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

- 학습자료: 별도 앱으로 분리됨 — 이 앱에 없음
- 홈 성능: 전체 문제 fetch 대신 `/stats/counts` count only 사용
- 선지 선택: 클라이언트 즉시 판정 후 `/solve` 백그라운드 전송
