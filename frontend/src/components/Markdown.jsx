// 경량 마크다운 렌더러 — 코드 블록(```), 인라인 코드, **굵게**, 제목(#)만.
// 에이전트 응답 표시용. HTML은 만들지 않고 React 노드로만 구성 (XSS 없음)

function inline(text, keyBase) {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g)
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`
    if (p.startsWith('`') && p.endsWith('`') && p.length > 1) {
      return <code key={k} className="md-code">{p.slice(1, -1)}</code>
    }
    if (p.startsWith('**') && p.endsWith('**') && p.length > 3) {
      return <strong key={k}>{p.slice(2, -2)}</strong>
    }
    return p
  })
}

export default function Markdown({ text }) {
  const chunks = (text || '').split(/```[^\n]*\n?/)
  return (
    <div className="md">
      {chunks.map((chunk, i) => {
        if (i % 2 === 1) {
          return <pre key={i} className="md-pre">{chunk.replace(/\n$/, '')}</pre>
        }
        return chunk.split('\n').map((line, j) => {
          const h = line.match(/^(#{1,4})\s+(.*)$/)
          if (h) return <div key={`${i}-${j}`} className="md-h">{inline(h[2], `${i}-${j}`)}</div>
          return <div key={`${i}-${j}`} className="md-line">{line ? inline(line, `${i}-${j}`) : ' '}</div>
        })
      })}
      <style>{`
        .md { line-height: 1.6; word-break: break-word; }
        .md-line { white-space: pre-wrap; }
        .md-h { font-weight: 700; margin: 6px 0 2px; }
        .md-code { font-family: ui-monospace, monospace; font-size: 0.9em; background: var(--bg3); padding: 1px 4px; border-radius: 4px; }
        .md-pre { font-family: ui-monospace, monospace; font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px; margin: 6px 0; overflow-x: auto; white-space: pre; }
      `}</style>
    </div>
  )
}
