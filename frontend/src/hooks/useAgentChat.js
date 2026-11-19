import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

// 에이전트는 별도 서비스(exam-agent, :8009) — 8008 백엔드 kill/재기동에 같이 죽지 않게 분리.
// 주소는 접속 호스트 기준으로 유도 (Tailscale IP 그대로 동작). prod(https)에선 mixed content라 불가.
const AGENT_PORT = import.meta.env.VITE_AGENT_PORT ?? '8009'
const agentWsUrl = () => `ws://${window.location.hostname}:${AGENT_PORT}/ws/agent`

export const agentAvailable = () => window.location.protocol === 'http:'

async function currentToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

/**
 * 서버 Claude Code 세션 허브와의 WS 연결.
 * 서버가 접속마다 이벤트 로그 전체 + 대기 승인을 재전송하므로, 재접속 시 로컬 목록을 비운다.
 * enabled=false면 연결하지 않는다 (로그인 전).
 */
export function useAgentChat(enabled = true) {
  const [events, setEvents] = useState([])
  const [pending, setPending] = useState([])
  const [state, setState] = useState('disconnected') // disconnected / idle / running
  const [sessionId, setSessionId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [socketOpen, setSocketOpen] = useState(false)
  const [fatal, setFatal] = useState(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    let active = true
    let timer

    function connect() {
      if (!active) return
      setEvents([])
      setPending([])
      const ws = new WebSocket(agentWsUrl())
      wsRef.current = ws
      ws.onopen = async () => {
        // 토큰은 URL이 아니라 첫 메시지로 (액세스 로그 보호). 매 접속마다 최신 토큰 (자동 갱신 반영)
        ws.send(JSON.stringify({ type: 'auth', token: await currentToken() }))
        ws.send(JSON.stringify({ type: 'sessions' }))
        setSocketOpen(true)
        setFatal(null)
      }
      ws.onmessage = (e) => {
        let ev
        try { ev = JSON.parse(e.data) } catch { return }
        switch (ev.type) {
          case 'status':
            setState(ev.state)
            setSessionId(ev.session_id ?? null)
            if (!ev.pending) setPending([])
            break
          case 'reset':
            setEvents([])
            setPending([])
            break
          case 'sessions':
            setSessions(ev.items || [])
            break
          case 'permission_request':
            setPending(p => (p.some(x => x.id === ev.id) ? p : [...p, ev]))
            break
          case 'permission_resolved':
            setPending(p => p.filter(x => x.id !== ev.id))
            setEvents(list => [...list, ev])
            break
          default:
            setEvents(list => [...list, ev])
        }
      }
      ws.onclose = (e) => {
        setSocketOpen(false)
        if (e.code === 4401) { setFatal('인증 실패 — 에이전트 소유자 계정(AGENT_OWNER_EMAIL)으로 로그인하세요'); active = false; return }
        if (e.code === 4404) { setFatal('에이전트 꺼짐 — backend/.env에 AGENT_ENABLED=true'); active = false; return }
        if (active) timer = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
    }

    connect()

    // 폰 화면을 다시 켰을 때 소켓이 죽어 있으면 즉시 재접속
    const onVisible = () => {
      if (!document.hidden && wsRef.current?.readyState === WebSocket.CLOSED && active) {
        clearTimeout(timer)
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      wsRef.current?.close()
    }
  }, [enabled])

  const send = useCallback((payload) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
  }, [])

  return {
    events, pending, state, sessionId, sessions, socketOpen, fatal,
    start: (session_id) => send({ type: 'start', session_id }),
    message: (text) => send({ type: 'message', text }),
    decide: (id, allow) => {
      setPending(p => p.filter(x => x.id !== id))
      send({ type: 'permission', id, allow })
    },
    interrupt: () => send({ type: 'interrupt' }),
    close: () => send({ type: 'close' }),
    refreshSessions: () => send({ type: 'sessions' }),
  }
}
