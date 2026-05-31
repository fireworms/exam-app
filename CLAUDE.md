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

환경변수 (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

---

## 주요 경로

| 경로 | 설명 |
|------|------|
| `backend/main.py` | 메인 앱 + 대부분 엔드포인트 |
| `backend/auth.py` | JWT 검증, `get_current_user` |
| `backend/db.py` | `get_supabase()`, `_new_auth_client()` |
| `backend/upload_router.py` | PDF/JSON 업로드 (`/api/upload`) |
| `backend/edit_router.py` | 문제 편집/이미지 (`/api/questions`) |
| `backend/vocab_router.py` | 단어장 (`/api/vocab`) |
| `backend/images/` | 문제 이미지 파일 (`q_{id}.jpg`) |
| `frontend/src/axios.js` | axios 인터셉터 (JWT 주입, refresh) |
| `frontend/src/tts.js` | TTS 유틸 — `speak()`, `useSpeaking()` 훅 |
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
exam_reports        id, user_id, question_id UNIQUE(user_id,question_id), created_at
exam_vocab          id, user_id, word, type(word|phrase), pos, meaning, example, example_translation, synonyms(jsonb), is_high_freq, source_text, created_at
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
| `POST /api/solve` | 답안 제출 → 정답 확인, 오답노트 처리 |
| `GET /api/wrong-notes` | 오답노트 목록 |
| `DELETE /api/wrong-notes/{question_id}` | 오답노트 제거 |
| `PUT /api/wrong-notes/{question_id}/memo` | 오답노트 메모 수정 |
| `GET /api/scraps` | 스크랩 목록 |
| `POST /api/scraps/{question_id}` | 스크랩 추가 |
| `DELETE /api/scraps/{question_id}` | 스크랩 삭제 |
| `POST /api/reports/{question_id}` | 문제 신고 |
| `DELETE /api/reports/{question_id}` | 신고 취소 |
| `GET /api/reports` | 전체 신고 목록 (관리자용) |
| `GET/PUT /api/settings` | 설정 조회/수정 |
| `GET /api/exams` | 시험 목록 |
| `DELETE /api/exams/{exam_id}` | 시험 삭제 |
| `POST /api/sessions` | 세션 시작 |
| `PUT /api/sessions/{id}/end` | 세션 종료 |
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
| `GET /api/vocab` | 단어 목록 (after 파라미터로 증분 fetch 지원) |
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
| `/stats` | Stats | 통계 + 많이 틀린 문제 |
| `/admin` | Admin | 관리자 페이지 (비밀번호 게이트) — 업로드/로그/회차관리/신고 탭 |
| `/edit/:question_id` | EditQuestion | 문제/이미지 수정 |
| `/vocab` | Vocab | 단어장 목록 (필터·정렬, URL 파라미터 유지) |
| `/settings` | Settings | auto_remove_wrong 설정 |
| `/upload`, `/logs` | — | `/admin`으로 리다이렉트 |

메뉴: 홈 / 오답노트 / 스크랩 / 통계 / 설정 / 🔐 관리자  
CSS 변수: `--bg`, `--bg2`, `--bg3`, `--border`, `--text`, `--text2`, `--accent`, `--correct`, `--wrong`, `--scrap`  
PC(768px+): `body { zoom: 1.25 }`

### 관리자 페이지 (`/admin`)

- `Admin.jsx` 상단 `ADMIN_PW` 상수로 비밀번호 변경 (기본값 `'1234'`)
- sessionStorage `_adm` 키로 세션 내 잠금 유지
- 신고 목록: 모든 유저의 신고 표시, 편집/해제 버튼 제공

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

- 학습자료: 별도 앱으로 분리됨 — 이 앱에 없음
- 홈 성능: 전체 문제 fetch 대신 `/api/stats/counts` count only 사용
- 선지 선택: 클라이언트 즉시 판정 후 `/api/solve` 백그라운드 전송
- 문제 풀기: 다음 문제 이동 및 로딩 완료 시 `window.scrollTo(0, 0)` 적용
- Quiz 신고 버튼: 🚩 버튼 → `POST /api/reports/{id}`, 중복 신고 무시
- 랜덤 문제: DB 조회 후 `random.shuffle()` 적용 — 미적용 시 ID 순(연도순) 정렬됨
- 토큰 갱신(`/api/auth/refresh`) 에러 구분: 네트워크 오류 → 503(로그아웃 안 함), 실제 토큰 만료/무효 → 401(로그아웃)
- 단어장 모드: Quiz에서 드래그 → Gemini 분석 → 모달 확인 후 저장. 파생어면 원형(`root_data`)도 함께 분석·표시·저장
- 단어장 목록: 초기 1회 fetch 후 필터·정렬은 클라이언트 `useMemo` 처리. 다른 탭 저장 감지는 `BroadcastChannel('vocab_update')`
- TTS(`tts.js`): 한글/영어 구간 분리 후 각각 ko-KR·en-US로 큐 읽기. `__밑줄__` 마크업·3개 이상 언더스코어·원문자 전처리 제거
