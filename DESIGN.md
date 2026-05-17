# exam-app 설계도

공무원 시험 문제 풀기 웹앱. PDF 시험지를 AI로 파싱하거나 JSON으로 직접 가져와 DB에 저장하고, 문제 풀기/오답노트/통계/학습자료 기능을 제공한다.

---

## 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | FastAPI (Python 3.12) + SQLite |
| 프론트엔드 | React + Vite (JSX, CSS-in-JS + `<style>` 태그) |
| AI 파서 | Gemini `gemini-2.0-flash-preview`, Claude `claude-sonnet-4-6` |
| 인증 | HTTP Basic Auth (`.env`로 on/off) |
| 배포 | FastAPI가 빌드된 프론트 정적 파일 서빙 (포트 8008) |
| 스타일 | CSS 변수 기반 다크 테마, Tailwind v4 병용 (학습자료 페이지) |

---

## 실행 (빌드 모드 — 개발 서버 사용 안 함)

```bash
cd frontend && npm run build
lsof -ti:8008 | xargs kill -9 2>/dev/null
cd backend && source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8008 > /tmp/backend.log 2>&1 &
```

접속: `http://192.168.50.102:8008`

환경변수 (`backend/.env`):
```
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
AUTH_USER=admin
AUTH_PASS=...
AUTH_ENABLED=false
```

---

## DB 스키마

```
exams           시험 메타데이터
  id, year, month, day, subject, grade, region, source_file

questions       문제
  id, exam_id → exams, number, question_text, question_image, explanation

choices         선지
  id, question_id → questions, number, text, is_correct

solve_history   풀이 기록
  id, question_id, selected_choice, is_correct, time_taken, session_id

wrong_notes     오답노트
  id, question_id UNIQUE, is_dismissed, memo, added_at

scraps          스크랩
  id, question_id UNIQUE, memo, created_at

sessions        풀기 세션
  id, mode, subject, exam_id, total_count, correct_count, skipped_count, duration

settings        앱 설정
  id=1, auto_remove_wrong

upload_logs     업로드 진행 상태
  id, source_file, status(pending→processing→done|failed), error_msg, exam_id

--- 학습자료 전용 (learning_router.py) ---

area_views          영역 열람 기록
  id, subject, area_key, viewed_at  UNIQUE(subject, area_key)

checklist_progress  체크리스트 진행 상태
  id, subject, item_id, checked, updated_at  UNIQUE(subject, item_id)

learn_bookmarks     학습 북마크
  id, subject, type, key, label, created_at  UNIQUE(subject, type, key)
```

중복 방지: `source_file` 기준으로 PDF/JSON 모두 업로드 전 검사.

---

## 백엔드 라우터

### main.py
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /subjects` | 과목별 문제 수 목록 |
| `GET /questions` | 문제 목록 (exam_id, subject 필터) |
| `GET /questions/random` | 랜덤 문제 (count, subject, source, exam_ids) |
| `GET /questions/exam-mode` | 시험 모드용 문제 (과목 목록, random/by_exam 모드) |
| `GET /questions/by_ids` | ID 배열로 문제 조회 |
| `GET /questions/{id}` | 단일 문제 조회 |
| `POST /solve` | 답안 제출 → 정답 확인, 오답노트 처리, auto_remove 적용 |
| `GET /wrong-notes` | 오답노트 목록 (is_dismissed=0) |
| `DELETE /wrong-notes/{id}` | 오답노트 제거 (is_dismissed=1) |
| `PUT /wrong-notes/{id}/memo` | 오답노트 메모 수정 |
| `GET/POST/DELETE /scraps` | 스크랩 CRUD |
| `GET/PUT /settings` | 설정 조회/수정 |
| `GET /exams` | 시험 목록 |
| `POST /sessions` | 세션 시작 |
| `PUT /sessions/{id}/end` | 세션 종료 |
| `GET /stats/overview` | 통계 (전체, 과목별, 날짜별) |

모든 엔드포인트에 `Depends(verify)` HTTP Basic Auth 적용.  
오답/스크랩 세션은 통계에서 제외 (`mode NOT IN ('wrong', 'scrap')`).

### upload_router.py (`/upload`)
| 엔드포인트 | 설명 |
|-----------|------|
| `POST /upload/analyze` | PDF 업로드 → 파일명 파싱 → 임시 저장 → 중복 여부 반환 |
| `POST /upload/confirm` | 파싱 시작 (백그라운드 스레드) |
| `POST /upload/json` | JSON 직접 임포트 (source_file 중복 검사 후 즉시 DB 저장) |
| `GET /upload/logs` | 업로드 로그 최근 100건 |

### edit_router.py (`/questions`)
| 엔드포인트 | 설명 |
|-----------|------|
| `POST /questions/{id}/image` | 문제 이미지 업로드 (`backend/images/q_{id}.jpg`) |
| `GET /questions/{id}/image` | 이미지 서빙 |
| `DELETE /questions/{id}/image` | 이미지 삭제 |
| `PUT /questions/{id}` | 문제 텍스트/선지/해설 수정 |

### learning_router.py (`/api/learn`)

#### 공통 (과목 무관)
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/learn/subjects` | 과목 목록 + type(korean/english) |
| `GET /api/learn/meta` | 과목 메타 정보 |
| `GET /api/learn/paradigm-shift` | 출제 경향 변화 (국어형) |
| `GET /api/learn/paradigm` | 출제 경향 변화 (영어형 포함) |
| `GET /api/learn/traps` | 함정 목록 |
| `GET /api/learn/motto` | 마지막 모토 |
| `GET /api/learn/progress` | 열람/체크리스트 진행도 |
| `POST /api/learn/progress/checklist` | 체크리스트 항목 토글 |
| `POST /api/learn/progress/checklist/reset` | 체크리스트 초기화 |
| `GET/POST /api/learn/bookmarks` | 북마크 조회/추가 |
| `DELETE /api/learn/bookmarks/{id}` | 북마크 삭제 |
| `GET /api/learn/checklist` | 체크리스트 + 진행도 |
| `GET /api/learn/search` | 학습자료 검색 |

#### 국어형 전용
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/learn/areas` | 영역 목록 |
| `GET /api/learn/areas/{key}` | 영역 상세 + 이전/다음 |
| `GET /api/learn/grammar` | 문법 기초 (`grammar_basics` or `korean_grammar_basics`) |
| `GET /api/learn/exam-mapping` | 회차 매핑 |
| `GET /api/learn/priority` | 학습 우선순위 |
| `GET /api/learn/top-areas` | 빈출 TOP 영역 |

#### 영어형 전용
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/learn/vocabulary` | 어휘 (분야별 딕셔너리) |
| `GET /api/learn/grammar-patterns` | 문법 패턴 배열 |
| `GET /api/learn/idioms` | 관용구 (분야별 딕셔너리) |
| `GET /api/learn/business-english` | 실무 영어 (카테고리별) |
| `GET /api/learn/time-strategy` | 시간 배분 전략 |
| `GET /api/learn/mindset` | 합격 마인드셋 |

---

## 학습자료 JSON 구조

`backend/data/*.json` 파일을 앱 시작 시 자동 로딩. `meta.subject`로 과목 식별.

### 국어형 (`type: "korean"`)
필수 키: `meta.subject`, `area_details`  
선택 키: `paradigm_shift`, `top_10_areas`, `korean_grammar_basics` or `grammar_basics`, `top_15_traps`, `exam_round_mapping`, `study_priority_guide`, `final_checklist`, `final_motto`

### 영어형 (`type: "english"`)
`vocabulary_essentials` 키 존재 여부로 자동 판별  
키 목록: `meta`, `exam_info`, `paradigm_shift_2025`, `top_10_frequent_areas`, `vocabulary_essentials`, `grammar_patterns`, `idioms_and_phrases`, `business_english`, `top_15_traps`, `time_allocation_strategy`, `exam_day_checklist`, `winning_mindset`

현재 파일:
- `요약노트_JSON.json` → 국어
- `영어_요약노트.json` → 영어

---

## 프론트엔드 페이지

### 일반 페이지 (Layout — 좌측 사이드바)
| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | Home | 시험 모드 선택, 과목·회차 선택 |
| `/quiz` | Quiz | 문제 풀기 (랜덤/오답/스크랩/시험 모드) |
| `/wrong-notes` | WrongNotes | 오답노트 목록 + 메모 |
| `/scraps` | Scraps | 스크랩 목록 |
| `/stats` | Stats | 통계 (전체 정답률, 과목별, 날짜별) |
| `/upload` | UploadPage | PDF 업로드 탭 + JSON 가져오기 탭 |
| `/logs` | LogsPage | 업로드 진행 상태 확인 |
| `/edit/:id` | EditQuestion | 문제 텍스트/선지/이미지 수정 |
| `/settings` | Settings | auto_remove_wrong 설정 |

### 학습자료 페이지 (LearnLayout — 전체화면 전환, 별도 헤더)
`/learn/*` — Layout 밖에서 독립적으로 렌더링. 상단 헤더에 "홈으로" 버튼.  
과목 드롭다운 선택 시 `type`에 따라 사이드바 메뉴 자동 교체.

#### 국어형 메뉴
| 경로 | 설명 |
|------|------|
| `/learn` | 대시보드 (패러다임 변화, TOP 영역, 진행도) |
| `/learn/areas` | 영역별 학습 목록 |
| `/learn/areas/:key` | 영역 상세 (아코디언, 북마크) |
| `/learn/traps` | 함정 모음 (검색, 확장) |
| `/learn/grammar` | 문법 기초 (탭) |
| `/learn/exam-mapping` | 회차 매핑 (필터) |
| `/learn/priority` | 학습 우선순위 |
| `/learn/checklist` | 시험 체크리스트 |
| `/learn/bookmarks` | 북마크 목록 |

#### 영어형 메뉴
| 경로 | 설명 |
|------|------|
| `/learn` | 영어 대시보드 (패러다임 전환, 빠른 이동, 마인드셋) |
| `/learn/en/vocabulary` | 어휘 학습 (플립카드 + TTS, 분야 탭) |
| `/learn/en/grammar` | 문법 패턴 10개 (목록+상세 분할) |
| `/learn/en/idioms` | 관용구 (직역/의역, 분야 탭) |
| `/learn/en/business` | 실무 영어 (이메일/회의/행정, 복사 버튼) |
| `/learn/traps` | 함정 모음 (공용) |
| `/learn/en/time-strategy` | 시간 전략 (단계별 배분) |
| `/learn/checklist` | 시험 체크리스트 (공용) |

### 스타일 시스템
- 일반 페이지: CSS-in-JS (`<style>` 태그) + CSS 변수
- 학습자료 페이지: `learn.css` (공유 클래스) + 인라인 스타일, Tailwind 없음
- CSS 변수: `--bg`, `--bg2`, `--bg3`, `--border`, `--text`, `--text2`, `--accent`, `--correct`, `--wrong`, `--scrap`

---

## PDF 업로드 흐름

```
1. /upload/analyze
   ├─ 파일명에서 연도·월·일·과목·등급·지역 파싱 (정규식 + 키워드 매칭)
   ├─ source_file 중복 검사
   └─ 임시 파일 backend/pdfs/temp/ 에 저장

2. 사용자가 메타데이터 확인/수정 후 확인

3. /upload/confirm
   ├─ upload_logs에 'pending' 레코드 삽입
   ├─ Gemini 파서: 순차 처리 (파일 간 15초 대기, 지수 백오프 재시도)
   └─ Claude 파서: 병렬 스레드 처리

4. background_parse()
   ├─ PDF → AI 파싱 → JSON
   ├─ save_to_db() → exams + questions + choices 삽입
   ├─ upload_logs 상태 → 'done'
   └─ 임시 파일 삭제
```

---

## AI 파서 차이

| | Gemini | Claude |
|--|--------|--------|
| 입력 | PDF 바이트 직접 전송 | PDF → 페이지별 PNG(2x) → base64 |
| 오류 재시도 | 429/503에서 지수 백오프 (최대 5회) | 없음 |
| 병렬 처리 | 불가 (순차 15초 간격) | 가능 (병렬 스레드) |
| 응답 형식 | `response_mime_type: application/json` | 마크다운 코드블록 파싱 |
