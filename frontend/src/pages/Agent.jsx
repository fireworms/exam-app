import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import Markdown from '../components/Markdown'
import { agentAvailable, useAgentChat } from '../hooks/useAgentChat'

// 모바일에서 서버의 Claude Code와 대화 (exam-agent 서비스, :8009).
// 이 페이지는 Layout 밖 — 채팅은 화면 전체 높이가 필요하고, :8009에는 /api가 없어 다른 페이지가 안 돈다.
// 로그인도 /api/auth/login 대신 supabase-js로 직접.

const STATE_LABEL = {
  disconnected: { text: '대기', color: 'var(--text2)' },
  idle: { text: '연결됨', color: 'var(--correct)' },
  running: { text: '응답 중…', color: 'var(--accent2)' },
}
const ORIGIN_LABEL = { terminal: '터미널', web: '웹' }
const ACTIVE_MS = 10 * 60 * 1000 // 터미널 세션이 최근 10분 내 기록됐으면 지금 쓰는 중일 수 있다

const isRecent = (ms) => Date.now() - ms < ACTIVE_MS

function timeAgo(ms) {
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`
}

function LoginForm({ onDone }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  async function submit(e) {
    e.preventDefault()
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr(error.message)
    else onDone()
  }
  return (
    <form onSubmit={submit} className="ag-login">
      <div className="ag-title">Claude 에이전트 로그인</div>
      <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
      <input type="password" placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" />
      {err && <div className="ag-err">{err}</div>}
      <button type="submit" className="ag-btn ag-primary">로그인</button>
    </form>
  )
}

export default function Agent() {
  const [authed, setAuthed] = useState(null) // null = 확인 중
  const chat = useAgentChat(authed === true)
  const [input, setInput] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const [openTools, setOpenTools] = useState({})
  const bottomRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setAuthed(!!session))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.events.length, chat.pending.length])

  // tool_result를 tool_use 아래에 붙여 그리기 위한 맵
  const results = useMemo(() => {
    const m = {}
    for (const e of chat.events) if (e.type === 'tool_result') m[e.id] = e
    return m
  }, [chat.events])

  if (!agentAvailable()) {
    return (
      <div className="ag-msg">
        에이전트는 로컬 서버에서만 열립니다 — <code>http://&lt;tailscale-ip&gt;:8009/agent</code>
        <style>{styles}</style>
      </div>
    )
  }
  if (authed === null) return null
  if (!authed) return <div className="ag"><LoginForm onDone={() => setAuthed(true)} /><style>{styles}</style></div>
  if (chat.fatal) return <div className="ag-msg ag-err">{chat.fatal}<style>{styles}</style></div>

  function submit() {
    const text = input.trim()
    if (!text || chat.state === 'running') return
    chat.message(text)
    setInput('')
  }

  function pick(id) {
    chat.start(id)
    setShowSessions(false)
  }

  const badge = STATE_LABEL[chat.state] ?? STATE_LABEL.disconnected
  const sessionPanel = showSessions || (chat.state === 'disconnected' && chat.events.length === 0)

  return (
    <div className="ag">
      {/* 헤더 */}
      <div className="ag-head">
        <Link to="/" className="ag-home">合</Link>
        <span className="ag-title">Claude 에이전트</span>
        <span className="ag-badge" style={{ color: chat.socketOpen ? badge.color : 'var(--wrong)' }}>
          {chat.socketOpen ? badge.text : '서비스 연결 끊김'}
        </span>
        {chat.sessionId && <span className="ag-sid">{chat.sessionId.slice(0, 8)}</span>}
        <div className="ag-head-btns">
          {chat.state === 'running' && (
            <button onClick={chat.interrupt} className="ag-btn ag-danger">중단</button>
          )}
          <button onClick={() => { chat.refreshSessions(); setShowSessions(v => !v) }} className="ag-btn">세션</button>
        </div>
      </div>

      {/* 세션 선택 */}
      {sessionPanel && (
        <div className="ag-sessions">
          <div className="ag-warn">터미널에서 쓰고 있는 세션을 여기서 동시에 이어 쓰지 마세요 — 기록이 꼬입니다.</div>
          <button onClick={() => pick(null)} className="ag-btn ag-primary ag-full">+ 새 세션</button>
          {chat.sessions.map(s => (
            <button
              key={s.session_id}
              onClick={() => pick(s.session_id)}
              className={`ag-sess ${s.session_id === chat.sessionId ? 'on' : ''}`}
            >
              <div className="ag-sess-top">
                {ORIGIN_LABEL[s.origin] && <span className={`ag-tag ${s.origin}`}>{ORIGIN_LABEL[s.origin]}</span>}
                <span className="ag-sess-title">{s.title || '(제목 없음)'}</span>
              </div>
              {s.origin === 'terminal' && isRecent(s.last_modified) && (
                <div className="ag-warn">터미널에서 사용 중일 수 있음</div>
              )}
              {s.mixed && <div className="ag-sub">터미널·웹 양쪽에서 이어 쓴 세션</div>}
              <div className="ag-sub">{timeAgo(s.last_modified)} · <span className="ag-mono">{s.session_id.slice(0, 8)}</span></div>
            </button>
          ))}
        </div>
      )}

      {/* 대화 */}
      <div className="ag-log">
        {chat.events.map((e, i) => {
          switch (e.type) {
            case 'user':
              return <div key={i} className="ag-user-row"><div className="ag-user">{e.text}</div></div>
            case 'text':
              return <div key={i} className="ag-text"><Markdown text={e.text} /></div>
            case 'tool_use': {
              const r = results[e.id]
              const open = openTools[e.id]
              return (
                <div key={i} className="ag-tool">
                  <button onClick={() => setOpenTools(o => ({ ...o, [e.id]: !o[e.id] }))} className="ag-tool-head">
                    <span className={`ag-tool-name ${r?.is_error ? 'err' : ''}`}>{e.name}</span>
                    <span className="ag-tool-sum">{e.summary}</span>
                    <span className="ag-sub">{r ? (open ? '▲' : '▼') : '…'}</span>
                  </button>
                  {open && r && <pre className="ag-tool-out">{r.preview || '(출력 없음)'}</pre>}
                </div>
              )
            }
            case 'blocked':
              return (
                <div key={i} className="ag-blocked">
                  ⛔ 차단: {e.reason}
                  <div className="ag-mono ag-ellipsis">{e.summary}</div>
                </div>
              )
            case 'permission_resolved':
              return (
                <div key={i} className="ag-sub" style={{ color: e.allowed ? 'var(--correct)' : undefined }}>
                  {e.allowed ? '✓ 허용' : '✕ 거부'} · {e.name}
                </div>
              )
            case 'result':
              return (
                <div key={i} className="ag-sub ag-right">
                  {(e.duration_ms / 1000).toFixed(1)}s
                  {e.terminal_reason && e.terminal_reason !== 'completed' ? ` · ${e.terminal_reason}` : ''}
                </div>
              )
            case 'notice': // 서버 알림 (에이전트 코드 변경 → 자동 재시작 등)
              return <div key={i} className="ag-sub" style={{ color: 'var(--accent2)' }}>↻ {e.text}</div>
            case 'error':
              return <div key={i} className="ag-err">⚠ {e.message}</div>
            default:
              return null // tool_result는 tool_use 아래에 접어서 표시
          }
        })}
        <div ref={bottomRef} />
      </div>

      {/* 승인 대기 */}
      {chat.pending.length > 0 && (
        <div className="ag-pending">
          {chat.pending.map(p => (
            <div key={p.id} className="ag-perm">
              <div className="ag-perm-title">승인 필요 · {p.title}</div>
              <pre className="ag-perm-cmd">{p.summary}</pre>
              {p.reason && <div className="ag-sub">{p.reason}</div>}
              <div className="ag-perm-btns">
                <button onClick={() => chat.decide(p.id, false)} className="ag-btn ag-big">거부</button>
                <button onClick={() => chat.decide(p.id, true)} className="ag-btn ag-big ag-allow">허용</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 입력 */}
      <div className="ag-input">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
          }}
          rows={2}
          placeholder={chat.state === 'running' ? '응답 중…' : '메시지 (Ctrl+Enter 전송)'}
        />
        <button
          onClick={submit}
          disabled={!input.trim() || chat.state === 'running' || !chat.socketOpen}
          className="ag-btn ag-primary ag-send"
        >
          전송
        </button>
      </div>
      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .ag { display: flex; flex-direction: column; min-height: 100dvh; max-width: 760px; margin: 0 auto; padding: 0 12px; }
  .ag-msg { padding: 24px 16px; font-size: 14px; color: var(--text2); }
  .ag-head { position: sticky; top: 0; z-index: 10; background: var(--bg); display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .ag-home { color: var(--accent); font-size: 20px; text-decoration: none; }
  .ag-title { font-weight: 700; font-size: 14px; }
  .ag-badge { font-size: 11px; }
  .ag-sid, .ag-mono { font-family: ui-monospace, monospace; font-size: 11px; color: var(--text2); }
  .ag-head-btns { margin-left: auto; display: flex; gap: 6px; }
  .ag-btn { font-size: 12px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text); cursor: pointer; }
  .ag-btn:disabled { opacity: 0.4; cursor: default; }
  .ag-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .ag-danger { background: var(--wrong); border-color: var(--wrong); color: #fff; }
  .ag-full { width: 100%; text-align: left; padding: 9px 12px; font-size: 14px; }
  .ag-sessions { margin-top: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg2); display: flex; flex-direction: column; gap: 8px; }
  .ag-warn { font-size: 11px; color: #f0b429; }
  .ag-sess { text-align: left; padding: 8px 12px; border-radius: 8px; border: 1px solid transparent; background: var(--bg); color: var(--text); cursor: pointer; }
  .ag-sess.on { border-color: var(--accent); }
  .ag-sess-top { display: flex; align-items: center; gap: 6px; }
  .ag-sess-title { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ag-tag { flex-shrink: 0; font-size: 10px; padding: 1px 4px; border-radius: 4px; background: var(--bg3); color: var(--text2); }
  .ag-tag.terminal { color: var(--accent2); }
  .ag-sub { font-size: 11px; color: var(--text2); }
  .ag-right { text-align: right; }
  .ag-log { flex: 1; padding: 12px 0; display: flex; flex-direction: column; gap: 10px; }
  .ag-user-row { display: flex; justify-content: flex-end; }
  .ag-user { max-width: 85%; background: var(--accent); color: #fff; border-radius: 16px 16px 4px 16px; padding: 8px 12px; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
  .ag-text { font-size: 14px; }
  .ag-tool { border: 1px solid var(--border); border-radius: 6px; background: var(--bg2); }
  .ag-tool-head { width: 100%; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: none; border: none; color: var(--text); cursor: pointer; text-align: left; }
  .ag-tool-name { font-size: 10px; padding: 1px 4px; border-radius: 4px; background: var(--bg3); color: var(--text2); flex-shrink: 0; }
  .ag-tool-name.err { color: var(--wrong); }
  .ag-tool-sum { flex: 1; font-family: ui-monospace, monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ag-tool-out { margin: 0; padding: 0 10px 8px; font-size: 11px; color: var(--text2); white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto; }
  .ag-blocked { font-size: 12px; border: 1px solid var(--wrong); border-radius: 6px; padding: 6px 10px; color: var(--wrong); }
  .ag-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ag-err { font-size: 12px; color: var(--wrong); white-space: pre-wrap; }
  .ag-pending { position: sticky; bottom: 84px; z-index: 10; display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
  .ag-perm { border: 1px solid #f0b429; border-radius: 10px; background: var(--bg2); padding: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.4); }
  .ag-perm-title { font-size: 12px; color: #f0b429; margin-bottom: 4px; }
  .ag-perm-cmd { margin: 0; font-family: ui-monospace, monospace; font-size: 11px; background: var(--bg); border-radius: 6px; padding: 8px; white-space: pre-wrap; word-break: break-all; max-height: 160px; overflow-y: auto; }
  .ag-perm-btns { display: flex; gap: 8px; margin-top: 8px; }
  .ag-big { flex: 1; padding: 10px; font-size: 14px; }
  .ag-allow { background: #c88a12; border-color: #c88a12; color: #fff; font-weight: 600; }
  .ag-input { position: sticky; bottom: 0; background: var(--bg); padding: 8px 0 12px; display: flex; gap: 8px; align-items: flex-end; }
  .ag-input textarea { flex: 1; resize: none; border-radius: 8px; background: var(--bg2); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; font-size: 14px; font-family: inherit; }
  .ag-input textarea:focus { outline: none; border-color: var(--accent); }
  .ag-send { padding: 10px 16px; font-size: 14px; }
  .ag-login { margin: 15vh auto 0; width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 10px; }
  .ag-login input { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg2); color: var(--text); font-size: 14px; }
  .ag-login .ag-btn { padding: 10px; font-size: 14px; }
`
