import { useState, useRef } from "react";
import API from '../api';
import axiosInstance from '../axios';

const JSON_FORMAT_TEMPLATE = `{
  "exam": {
    "year": 2026,
    "month": 4,
    "day": 5,
    "subject": "영어",
    "grade": "9급",
    "region": "국가직",
    "source_file": "AI예상문제_2026_9급국가직영어"
  },
  "questions": [
    {
      "number": 1,
      "question_text": "문제 전체 텍스트 (지문, 사료, 코드, 표 등 모두 포함)",
      "choices": [
        {"number": 1, "text": "선지1", "is_correct": false},
        {"number": 2, "text": "선지2", "is_correct": true},
        {"number": 3, "text": "선지3", "is_correct": false},
        {"number": 4, "text": "선지4", "is_correct": false}
      ],
      "explanation": "정답과 오답에 대한 상세 해설 (오답 선지별 이유 포함)"
    }
  ]
}`;

const SUBJECTS = [
  "한국사", "국어", "영어", "수학", "행정법총론", "행정학개론",
  "사회", "과학", "컴퓨터일반", "정보보호론", "세법개론", "회계학",
  "행정법", "행정학", "경제학", "사회복지학", "교육학", "심리학",
  "물리", "화학", "생물", "지구과학", "지리", "윤리", "정치",
  "전기", "기계", "토목", "건축", "화공", "통신", "전자",
];

const GRADES = ["5급", "7급", "9급", "경위", "소방", "교육행정"];
const REGIONS = [
  "국가직", "지방직", "서울시", "경기도", "부산", "대구", "인천",
  "광주", "대전", "울산", "세종", "강원", "충북", "충남",
  "전북", "전남", "경북", "경남", "제주", "소방직", "교행직",
];

export default function UploadPage() {
  const [tab, setTab] = useState("pdf");

  // PDF 탭 상태
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [parser, setParser] = useState("claude");
  const fileInputRef = useRef();

  // JSON 탭 상태 — items: [{name, parsed, status: 'pending'|'done'|'error', result, error}]
  const [jsonItems, setJsonItems] = useState([]);
  const [jsonImporting, setJsonImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const jsonInputRef = useRef();

  const readJsonFile = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (!parsed.exam || !Array.isArray(parsed.questions)) {
            resolve({ name: file.name, parsed: null, status: "error", error: "형식 오류: exam + questions 필요" });
          } else {
            resolve({ name: file.name, parsed, status: "pending" });
          }
        } catch {
          resolve({ name: file.name, parsed: null, status: "error", error: "JSON 파싱 실패" });
        }
      };
      reader.readAsText(file);
    });

  const handleJsonFiles = async (files) => {
    const jsonFiles = Array.from(files).filter((f) => f.name.endsWith(".json"));
    if (!jsonFiles.length) return;
    const items = await Promise.all(jsonFiles.map(readJsonFile));
    setJsonItems((prev) => {
      const existingNames = new Set(prev.map((i) => i.name));
      return [...prev, ...items.filter((i) => !existingNames.has(i.name))];
    });
  };

  const removeJsonItem = (name) =>
    setJsonItems((prev) => prev.filter((i) => i.name !== name));

  const handleJsonImportAll = async () => {
    const pending = jsonItems.filter((i) => i.status === "pending");
    if (!pending.length) return;
    setJsonImporting(true);
    for (const item of pending) {
      setJsonItems((prev) =>
        prev.map((i) => (i.name === item.name ? { ...i, status: "uploading" } : i))
      );
      try {
        const { data } = await axiosInstance.post(`${API}/upload/json`, item.parsed);
        setJsonItems((prev) =>
          prev.map((i) => (i.name === item.name ? { ...i, status: "done", result: data } : i))
        );
      } catch (e) {
        const msg = e.response?.data?.detail || e.message || "서버 오류";
        setJsonItems((prev) =>
          prev.map((i) => (i.name === item.name ? { ...i, status: "error", error: msg } : i))
        );
      }
    }
    setJsonImporting(false);
  };

  const handleCopyFormat = () => {
    navigator.clipboard.writeText(JSON_FORMAT_TEMPLATE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleFiles = async (selectedFiles) => {
    if (!selectedFiles.length) return;
    setLoading(true);
    setDone(false);

    const formData = new FormData();
    for (const f of selectedFiles) formData.append("files", f);

    try {
      const { data } = await axiosInstance.post(`${API}/upload/analyze`, formData);
      setFiles(data.files.map((f) => ({ ...f, skip: f.is_duplicate })));
    } catch (e) {
      alert("분석 실패: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const updateField = (idx, field, value) => {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === idx ? { ...f, parsed: { ...f.parsed, [field]: value } } : f
      )
    );
  };

  const toggleSkip = (idx) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, skip: !f.skip } : f))
    );
  };

  const handleConfirm = async () => {
    const toUpload = files.filter((f) => !f.skip);
    if (!toUpload.length) {
      alert("업로드할 파일이 없어요.");
      return;
    }
    setConfirming(true);
    try {
      const { data } = await axiosInstance.post(`${API}/upload/confirm`, {
        items: toUpload.map((f) => ({
          filename: f.filename,
          exam_info: f.parsed,
          parser,
        })),
      });
      if (data.started) {
        setDone(true);
        setFiles([]);
      }
    } catch (e) {
      alert("컨펌 실패: " + (e.response?.data?.detail || e.message));
    } finally {
      setConfirming(false);
    }
  };

  const toUploadCount = files.filter((f) => !f.skip).length;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>문제 업로드</h1>
        <p style={styles.subtitle}>PDF 자동 파싱 또는 AI 생성 JSON 직접 가져오기</p>
      </div>

      {/* 탭 */}
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tabBtn, ...(tab === "pdf" ? styles.tabBtnActive : {}) }}
          onClick={() => setTab("pdf")}
        >
          PDF 업로드
        </button>
        <button
          style={{ ...styles.tabBtn, ...(tab === "json" ? styles.tabBtnActive : {}) }}
          onClick={() => setTab("json")}
        >
          JSON 가져오기
        </button>
      </div>

      {/* JSON 탭 */}
      {tab === "json" && (
        <div>
          {/* JSON 형식 안내 */}
          <div style={styles.formatBox}>
            <div style={styles.formatHeader}>
              <span style={styles.formatTitle}>Claude AI에게 줄 JSON 형식</span>
              <button style={styles.copyBtn} onClick={handleCopyFormat}>
                {copied ? "복사됨!" : "형식 복사"}
              </button>
            </div>
            <pre style={styles.formatPre}>{JSON_FORMAT_TEMPLATE}</pre>
          </div>

          {/* 드롭존 (항상 표시) */}
          <div
            style={styles.dropzone}
            onClick={() => jsonInputRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleJsonFiles(e.dataTransfer.files); }}
          >
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { handleJsonFiles(e.target.files); e.target.value = ""; }}
            />
            <div style={styles.dropIcon}>📄</div>
            <div style={styles.dropText}>JSON 파일을 드래그하거나 클릭해서 선택</div>
            <div style={styles.dropSub}>여러 파일 동시 선택 가능</div>
          </div>

          {/* 파일 목록 */}
          {jsonItems.length > 0 && (
            <>
              <div style={{ ...styles.listHeader, marginTop: 20 }}>
                <span style={styles.listCount}>{jsonItems.length}개 파일</span>
                <button style={styles.resetBtn} onClick={() => setJsonItems([])}>
                  모두 제거
                </button>
              </div>

              <div style={styles.fileList}>
                {jsonItems.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      ...styles.fileCard,
                      ...(item.status === "error" ? styles.fileCardDup : {}),
                      ...(item.status === "done" ? styles.fileCardDone : {}),
                    }}
                  >
                    <div style={styles.cardTop}>
                      <div>
                        {item.status === "done" && <span style={styles.doneBadge}>완료</span>}
                        {item.status === "error" && <span style={styles.dupBadge}>오류</span>}
                        {item.status === "uploading" && <span style={styles.uploadingBadge}>저장중</span>}
                        <strong style={{ fontSize: 13, marginLeft: item.status !== "pending" ? 8 : 0 }}>
                          {item.name}
                        </strong>
                        {item.parsed && (
                          <span style={styles.previewMeta}>
                            {" "}— {item.parsed.exam?.subject} {item.parsed.exam?.grade}{" "}
                            {item.parsed.exam?.region} {item.parsed.exam?.year}년{" "}
                            · {item.parsed.questions?.length}문제
                          </span>
                        )}
                        {item.status === "done" && item.result && (
                          <span style={styles.previewMeta}> (exam_id: {item.result.exam_id})</span>
                        )}
                        {item.status === "error" && (
                          <span style={{ color: "#dc2626", fontSize: 12, marginLeft: 8 }}>{item.error}</span>
                        )}
                      </div>
                      {item.status !== "uploading" && (
                        <button style={styles.resetBtn} onClick={() => removeJsonItem(item.name)}>
                          제거
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 전체 저장 버튼 */}
              {(() => {
                const pendingCount = jsonItems.filter((i) => i.status === "pending").length;
                return pendingCount > 0 ? (
                  <div style={{ ...styles.confirmWrap, marginTop: 20 }}>
                    <span style={styles.confirmInfo}>
                      {pendingCount}개 저장 대기
                    </span>
                    <button
                      style={{ ...styles.confirmBtn, ...(jsonImporting ? styles.confirmBtnDisabled : {}) }}
                      onClick={handleJsonImportAll}
                      disabled={jsonImporting}
                    >
                      {jsonImporting ? "저장 중..." : `${pendingCount}개 바로 저장`}
                    </button>
                  </div>
                ) : null;
              })()}
            </>
          )}
        </div>
      )}

      {/* PDF 탭 */}
      {tab === "pdf" && <>

      {/* 완료 메시지 */}
      {done && (
        <div style={styles.doneBox}>
          <span style={styles.doneIcon}>✓</span>
          <div>
            <div style={styles.doneTitle}>파싱 시작됨</div>
            <div style={styles.doneDesc}>
              백그라운드에서 처리 중이에요. 업로드 로그에서 진행 상황을 확인하세요.
            </div>
          </div>
          <button style={styles.logBtn} onClick={() => window.location.href = "/admin"}>
            로그 보기 →
          </button>
        </div>
      )}

      {/* 드롭존 */}
      {!files.length && (
        <div
          style={{ ...styles.dropzone, ...(dragging ? styles.dropzoneActive : {}) }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".pdf")));
          }}
          onClick={() => fileInputRef.current.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFiles(Array.from(e.target.files))}
          />
          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <div style={styles.loadingText}>파일명 분석 중...</div>
            </div>
          ) : (
            <>
              <div style={styles.dropIcon}>📂</div>
              <div style={styles.dropText}>PDF 파일을 드래그하거나 클릭해서 선택</div>
              <div style={styles.dropSub}>여러 파일 동시 업로드 가능</div>
            </>
          )}
        </div>
      )}

      {/* 파일 목록 */}
      {files.length > 0 && (
        <>
          <div style={styles.listHeader}>
            <span style={styles.listCount}>{files.length}개 파일 분석됨</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>파서</span>
              <div style={styles.parserToggle}>
                {[{ value: "claude", label: "Claude" }, { value: "gemini", label: "Gemini" }].map(({ value, label }) => (
                  <button
                    key={value}
                    style={{ ...styles.parserBtn, ...(parser === value ? styles.parserBtnActive : {}) }}
                    onClick={() => setParser(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                style={styles.resetBtn}
                onClick={() => { setFiles([]); setDone(false); }}
              >
                다시 선택
              </button>
            </div>
          </div>

          <div style={styles.fileList}>
            {files.map((f, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.fileCard,
                  ...(f.skip ? styles.fileCardSkipped : {}),
                  ...(f.is_duplicate ? styles.fileCardDup : {}),
                }}
              >
                {/* 파일명 + 스킵 토글 */}
                <div style={styles.cardTop}>
                  <div style={styles.fileNameWrap}>
                    {f.is_duplicate && (
                      <span style={styles.dupBadge}>중복</span>
                    )}
                    <span style={styles.fileName}>{f.filename}</span>
                  </div>
                  <label style={styles.skipLabel}>
                    <input
                      type="checkbox"
                      checked={f.skip}
                      onChange={() => toggleSkip(idx)}
                      style={{ marginRight: 6 }}
                    />
                    건너뛰기
                  </label>
                </div>

                {/* 폼 */}
                {!f.skip && (
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>과목</label>
                      <select
                        style={styles.select}
                        value={f.parsed.subject}
                        onChange={(e) => updateField(idx, "subject", e.target.value)}
                      >
                        <option value="">-- 선택 --</option>
                        {SUBJECTS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>등급</label>
                      <select
                        style={styles.select}
                        value={f.parsed.grade}
                        onChange={(e) => updateField(idx, "grade", e.target.value)}
                      >
                        <option value="">-- 선택 --</option>
                        {GRADES.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>지역/종류</label>
                      <select
                        style={styles.select}
                        value={f.parsed.region}
                        onChange={(e) => updateField(idx, "region", e.target.value)}
                      >
                        <option value="">-- 선택 --</option>
                        {REGIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>연도</label>
                      <input
                        style={styles.input}
                        type="number"
                        value={f.parsed.year ?? ""}
                        onChange={(e) => updateField(idx, "year", Number(e.target.value))}
                        placeholder="2025"
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>월</label>
                      <input
                        style={styles.input}
                        type="number"
                        min={1} max={12}
                        value={f.parsed.month ?? ""}
                        onChange={(e) => updateField(idx, "month", Number(e.target.value))}
                        placeholder="6"
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>일</label>
                      <input
                        style={styles.input}
                        type="number"
                        min={1} max={31}
                        value={f.parsed.day ?? ""}
                        onChange={(e) => updateField(idx, "day", Number(e.target.value))}
                        placeholder="21"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 컨펌 버튼 */}
          <div style={styles.confirmWrap}>
            <span style={styles.confirmInfo}>
              {toUploadCount}개 파싱 시작 ({files.length - toUploadCount}개 건너뜀)
            </span>
            <button
              style={{
                ...styles.confirmBtn,
                ...(confirming || !toUploadCount ? styles.confirmBtnDisabled : {}),
              }}
              onClick={handleConfirm}
              disabled={confirming || !toUploadCount}
            >
              {confirming ? "처리 중..." : `${toUploadCount}개 파싱 시작`}
            </button>
          </div>
        </>
      )}
      </>}
    </div>
  );
}

// ── 스타일 ──────────────────────────────────────────────────────────────────
const styles = {
  page: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "'Noto Sans KR', sans-serif",
    color: "#1a1a2e",
  },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { marginTop: 6, color: "#666", fontSize: 14 },

  tabBar: {
    display: "flex",
    gap: 4,
    marginBottom: 28,
    borderBottom: "2px solid #e2e8f0",
  },
  tabBtn: {
    padding: "10px 20px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#94a3b8",
    borderBottom: "2px solid transparent",
    marginBottom: -2,
  },
  tabBtnActive: {
    color: "#6366f1",
    borderBottom: "2px solid #6366f1",
  },

  formatBox: {
    background: "#0f172a",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  formatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #1e293b",
  },
  formatTitle: { color: "#94a3b8", fontSize: 13, fontWeight: 600 },
  copyBtn: {
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },
  formatPre: {
    margin: 0,
    padding: "16px",
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 1.6,
    overflowX: "auto",
    fontFamily: "monospace",
  },

  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 16,
  },

  previewMeta: { fontSize: 13, color: "#64748b", fontWeight: 400 },

  doneBadge: {
    background: "#dcfce7",
    color: "#16a34a",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
  uploadingBadge: {
    background: "#e0e7ff",
    color: "#4338ca",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
  fileCardDone: { borderColor: "#bbf7d0", background: "#f0fdf4" },

  doneBox: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 28,
  },
  doneIcon: { fontSize: 24, color: "#16a34a" },
  doneTitle: { fontWeight: 700, color: "#166534" },
  doneDesc: { fontSize: 13, color: "#15803d", marginTop: 2 },
  logBtn: {
    marginLeft: "auto",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  dropzone: {
    border: "2px dashed #cbd5e1",
    borderRadius: 16,
    padding: "60px 20px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    background: "#f8fafc",
  },
  dropzoneActive: {
    border: "2px dashed #6366f1",
    background: "#eef2ff",
  },
  dropIcon: { fontSize: 48, marginBottom: 12 },
  dropText: { fontSize: 16, fontWeight: 600, color: "#334155" },
  dropSub: { fontSize: 13, color: "#94a3b8", marginTop: 6 },
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: { color: "#6366f1", fontWeight: 600 },

  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  listCount: { fontWeight: 700, fontSize: 15 },
  resetBtn: {
    background: "none",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 13,
    color: "#64748b",
  },

  fileList: { display: "flex", flexDirection: "column", gap: 12 },

  fileCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "16px 20px",
    background: "#fff",
    transition: "opacity 0.2s",
  },
  fileCardSkipped: { opacity: 0.45 },
  fileCardDup: { borderColor: "#fca5a5", background: "#fff5f5" },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  fileNameWrap: { display: "flex", alignItems: "center", gap: 8 },
  dupBadge: {
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
  fileName: {
    fontSize: 13,
    color: "#334155",
    wordBreak: "break-all",
  },
  skipLabel: {
    fontSize: 13,
    color: "#64748b",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
    gap: 10,
  },
  formGroup: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" },
  select: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "7px 8px",
    fontSize: 13,
    background: "#f8fafc",
    color: "#1e293b",
    outline: "none",
  },
  input: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "7px 8px",
    fontSize: 13,
    background: "#f8fafc",
    color: "#1e293b",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },

  confirmWrap: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 16,
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid #e2e8f0",
  },
  confirmInfo: { fontSize: 13, color: "#64748b" },
  confirmBtn: {
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 28px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },
  confirmBtnDisabled: {
    background: "#c7d2fe",
    cursor: "not-allowed",
  },

  parserToggle: {
    display: "flex",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  parserBtn: {
    padding: "8px 16px",
    border: "none",
    background: "#f8fafc",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  parserBtnActive: {
    background: "#6366f1",
    color: "#fff",
    fontWeight: 700,
  },
};
