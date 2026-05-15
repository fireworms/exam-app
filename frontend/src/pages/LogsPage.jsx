import { useState, useEffect } from "react";
import API from "../api";

const STATUS_MAP = {
  pending:    { label: "대기 중",   color: "#f59e0b", bg: "#fffbeb" },
  processing: { label: "파싱 중",   color: "#6366f1", bg: "#eef2ff" },
  done:       { label: "완료",      color: "#16a34a", bg: "#f0fdf4" },
  failed:     { label: "실패",      color: "#dc2626", bg: "#fff5f5" },
};

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API}/upload/logs`);
      const data = await res.json();
      setLogs(data.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // 처리 중인 항목이 있으면 5초마다 갱신
    const interval = setInterval(() => {
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const hasProcessing = logs.some(
    (l) => l.status === "pending" || l.status === "processing"
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>업로드 로그</h1>
          <p style={styles.subtitle}>
            PDF 파싱 진행 상황을 확인할 수 있어요
            {hasProcessing && (
              <span style={styles.autoRefresh}> · 5초마다 자동 갱신 중</span>
            )}
          </p>
        </div>
        <button style={styles.refreshBtn} onClick={fetchLogs}>
          새로고침
        </button>
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
          {/* 헤더 */}
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
                  <span style={{
                    ...styles.badge,
                    color: st.color,
                    background: st.bg,
                    border: `1px solid ${st.color}33`,
                  }}>
                    {st.label}
                  </span>
                </span>
                <span style={{ flex: 2, fontSize: 13, color: "#64748b" }}>
                  {examLabel}
                </span>
                <span style={{ flex: 2, fontSize: 12, color: "#94a3b8" }}>
                  {createdAt}
                </span>
                <span style={{ flex: 2, fontSize: 12, color: "#dc2626" }}>
                  {log.error_msg || ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  title: { fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { marginTop: 6, color: "#666", fontSize: 14 },
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
  center: { textAlign: "center", padding: 60, color: "#94a3b8" },
  empty: {
    textAlign: "center",
    padding: 60,
    color: "#94a3b8",
    fontSize: 15,
  },
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
};
