import { useState, useRef } from "react";
import API from "../api";

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
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [parser, setParser] = useState("claude");
  const fileInputRef = useRef();

  const handleFiles = async (selectedFiles) => {
    if (!selectedFiles.length) return;
    setLoading(true);
    setDone(false);

    const formData = new FormData();
    for (const f of selectedFiles) formData.append("files", f);

    try {
      const res = await fetch(`${API}/upload/analyze`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setFiles(data.files.map((f) => ({ ...f, skip: f.is_duplicate })));
    } catch (e) {
      alert("분석 실패: " + e.message);
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
      const res = await fetch(`${API}/upload/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: toUpload.map((f) => ({
            filename: f.filename,
            exam_info: f.parsed,
            parser,
          })),
        }),
      });
      const data = await res.json();
      if (data.started) {
        setDone(true);
        setFiles([]);
      }
    } catch (e) {
      alert("컨펌 실패: " + e.message);
    } finally {
      setConfirming(false);
    }
  };

  const toUploadCount = files.filter((f) => !f.skip).length;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>PDF 업로드</h1>
        <p style={styles.subtitle}>시험지를 업로드하면 자동으로 파싱해서 DB에 저장돼요</p>
      </div>

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
          <button style={styles.logBtn} onClick={() => window.location.href = "/logs"}>
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
  header: { marginBottom: 32 },
  title: { fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { marginTop: 6, color: "#666", fontSize: 14 },

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
