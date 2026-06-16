import { useState, useEffect } from "react";
import API from '../api';
import axiosInstance from '../axios';

const STATUS_MAP = {
  pending:    { label: "대기 중",   color: "#f59e0b", bg: "#fffbeb" },
  processing: { label: "파싱 중",   color: "#6366f1", bg: "#eef2ff" },
  done:       { label: "완료",      color: "#16a34a", bg: "#f0fdf4" },
  failed:     { label: "실패",      color: "#dc2626", bg: "#fff5f5" },
};

export function UploadLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const { data } = await axiosInstance.get(`${API}/upload/logs`);
      setLogs(data.logs ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const hasProcessing = logs.some(
    (l) => l.status === "pending" || l.status === "processing"
  );

  return (
    <>
      <div style={styles.subHeader}>
        <p style={styles.subtitle}>
          PDF 파싱 진행 상황을 확인할 수 있어요
          {hasProcessing && (
            <span style={styles.autoRefresh}> · 5초마다 자동 갱신 중</span>
          )}
        </p>
        <button style={styles.refreshBtn} onClick={fetchLogs}>새로고침</button>
      </div>

      {loading ? (
        <div style={styles.center}>불러오는 중...</div>
      ) : logs.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📭</div>
          <div>업로드 기록이 없어요</div>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={{ flex: 3 }}>파일명</span>
            <span style={{ flex: 1, textAlign: "center" }}>상태</span>
            <span style={{ flex: 2 }}>시험 정보</span>
            <span style={{ flex: 2 }}>시각</span>
            <span style={{ flex: 2 }}>오류</span>
          </div>
          {logs.map((log) => {
            const st = STATUS_MAP[log.status] || STATUS_MAP.pending;
            const examLabel = log.subject
              ? `${log.year}년 ${log.month}월 / ${[log.grade, log.region, log.subject].filter(Boolean).join(" · ")}`
              : "-";
            const createdAt = new Date(log.created_at).toLocaleString("ko-KR", {
              month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit",
            });
            return (
              <div key={log.id} style={styles.tableRow}>
                <span style={{ flex: 3, fontSize: 13, wordBreak: "break-all", color: "#334155" }}>
                  {log.source_file}
                </span>
                <span style={{ flex: 1, textAlign: "center" }}>
                  <span style={{ ...styles.badge, color: st.color, background: st.bg, border: `1px solid ${st.color}33` }}>
                    {st.label}
                  </span>
                </span>
                <span style={{ flex: 2, fontSize: 13, color: "#64748b" }}>{examLabel}</span>
                <span style={{ flex: 2, fontSize: 12, color: "#94a3b8" }}>{createdAt}</span>
                <span style={{ flex: 2, fontSize: 12, color: "#dc2626" }}>{log.error_msg || ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function ExamManager() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");

  const fetchExams = async () => {
    try {
      const { data } = await axiosInstance.get(`${API}/exams`);
      setExams(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExams(); }, []);

  const handleDelete = async (examId) => {
    setDeleting(true);
    try {
      await axiosInstance.delete(`${API}/exams/${examId}`);
      setExams(prev => prev.filter(e => e.id !== examId));
      setConfirmId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const confirmExam = exams.find(e => e.id === confirmId);

  const subjects = [...new Set(exams.map(e => e.subject).filter(Boolean))].sort();
  const visibleExams = subjectFilter ? exams.filter(e => e.subject === subjectFilter) : exams;

  return (
    <>
      <div style={styles.subHeader}>
        <p style={styles.subtitle}>회차를 삭제하면 문제·오답노트·스크랩·풀이 기록이 모두 삭제돼요</p>
        <button style={styles.refreshBtn} onClick={fetchExams}>새로고침</button>
      </div>

      {!loading && exams.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <button
            style={subjectFilter === "" ? styles.subjectChipOn : styles.subjectChip}
            onClick={() => setSubjectFilter("")}
          >
            전체 ({exams.length})
          </button>
          {subjects.map(s => (
            <button
              key={s}
              style={subjectFilter === s ? styles.subjectChipOn : styles.subjectChip}
              onClick={() => setSubjectFilter(s)}
            >
              {s} ({exams.filter(e => e.subject === s).length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={styles.center}>불러오는 중...</div>
      ) : exams.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📭</div>
          <div>등록된 회차가 없어요</div>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={{ flex: 3 }}>시험 정보</span>
            <span style={{ flex: 2 }}>파일명</span>
            <span style={{ flex: 1, textAlign: "center" }}>문제 수</span>
            <span style={{ flex: 1, textAlign: "center" }}>삭제</span>
          </div>
          {visibleExams.map((exam) => {
            const label = [exam.year && `${exam.year}년`, exam.month && `${exam.month}월`, exam.day && `${exam.day}일`].filter(Boolean).join(" ");
            const meta = [exam.grade, exam.region, exam.subject].filter(Boolean).join(" · ");
            return (
              <div key={exam.id} style={styles.tableRow}>
                <span style={{ flex: 3, fontSize: 13, color: "#334155" }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  {meta && <span style={{ color: "#64748b", marginLeft: 8 }}>{meta}</span>}
                </span>
                <span style={{ flex: 2, fontSize: 12, color: "#94a3b8", wordBreak: "break-all" }}>
                  {exam.source_file || "-"}
                </span>
                <span style={{ flex: 1, textAlign: "center", fontSize: 13, color: "#334155" }}>
                  {exam.question_count}문제
                </span>
                <span style={{ flex: 1, textAlign: "center" }}>
                  {confirmId === exam.id ? (
                    <span style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button
                        style={styles.confirmBtn}
                        onClick={() => handleDelete(exam.id)}
                        disabled={deleting}
                      >
                        {deleting ? "..." : "확인"}
                      </button>
                      <button style={styles.cancelBtn} onClick={() => setConfirmId(null)}>취소</button>
                    </span>
                  ) : (
                    <button style={styles.deleteBtn} onClick={() => setConfirmId(exam.id)}>삭제</button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {confirmId && confirmExam && (
        <div style={styles.overlay} onClick={() => setConfirmId(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>회차 삭제</p>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 4 }}>
              {[confirmExam.year && `${confirmExam.year}년`, confirmExam.month && `${confirmExam.month}월`].filter(Boolean).join(" ")}
              {" "}
              {[confirmExam.grade, confirmExam.region, confirmExam.subject].filter(Boolean).join(" · ")}
            </p>
            <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
              이 회차의 문제 {confirmExam.question_count}개와 관련된 오답노트·스크랩·풀이 기록이 모두 삭제돼요. 되돌릴 수 없어요.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={styles.cancelBtn} onClick={() => setConfirmId(null)}>취소</button>
              <button style={styles.confirmBtn} onClick={() => handleDelete(confirmId)} disabled={deleting}>
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function LogsPage() {
  const [tab, setTab] = useState("logs");

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>관리</h1>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === "logs" ? styles.tabActive : {}) }}
            onClick={() => setTab("logs")}
          >
            업로드 로그
          </button>
          <button
            style={{ ...styles.tab, ...(tab === "exams" ? styles.tabActive : {}) }}
            onClick={() => setTab("exams")}
          >
            회차 관리
          </button>
        </div>
      </div>

      {tab === "logs" ? <UploadLogs /> : <ExamManager />}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "'Noto Sans KR', sans-serif",
    color: "#1a1a2e",
  },
  header: {
    marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: 700, margin: "0 0 16px" },
  tabs: { display: "flex", gap: 4, borderBottom: "2px solid #e2e8f0", paddingBottom: 0 },
  tab: {
    background: "none",
    border: "none",
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 600,
    color: "#94a3b8",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: -2,
    transition: "all 0.15s",
  },
  tabActive: { color: "#6366f1", borderBottom: "2px solid #6366f1" },
  subHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  subtitle: { color: "#666", fontSize: 14, margin: 0 },
  autoRefresh: { color: "#6366f1", fontWeight: 600 },
  refreshBtn: {
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 13,
    color: "#475569",
    fontWeight: 600,
  },
  subjectChip: {
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "5px 12px",
    cursor: "pointer",
    fontSize: 13,
    color: "#475569",
    fontWeight: 600,
  },
  subjectChipOn: {
    background: "#2563eb",
    border: "1px solid #2563eb",
    borderRadius: 16,
    padding: "5px 12px",
    cursor: "pointer",
    fontSize: 13,
    color: "#fff",
    fontWeight: 600,
  },
  center: { textAlign: "center", padding: 60, color: "#94a3b8" },
  empty: { textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 15 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  table: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
  },
  tableHeader: {
    display: "flex",
    gap: 12,
    padding: "12px 20px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "flex",
    gap: 12,
    padding: "14px 20px",
    borderBottom: "1px solid #f1f5f9",
    alignItems: "center",
  },
  badge: {
    display: "inline-block",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  deleteBtn: {
    background: "#fff5f5",
    border: "1px solid #fca5a5",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#dc2626",
    cursor: "pointer",
  },
  confirmBtn: {
    background: "#dc2626",
    border: "none",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
  },
  cancelBtn: {
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 14,
    padding: "28px 28px 24px",
    maxWidth: 400,
    width: "90%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
};
