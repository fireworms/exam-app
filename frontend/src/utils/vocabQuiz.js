// 단어장 퀴즈 — 정답률 계산·출제 헬퍼

export function quizTotal(item) {
  return (item.quiz_correct || 0) + (item.quiz_wrong || 0)
}

// 푼 적 없으면 null
export function wrongRate(item) {
  const total = quizTotal(item)
  return total ? (item.quiz_wrong || 0) / total : null
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 많이 틀린 단어·안 풀어본 단어가 더 자주 나오도록 가중 랜덤
function pickWeighted(pool, excludeId) {
  const candidates = pool.length > 1 ? pool.filter(i => i.id !== excludeId) : pool
  const weights = candidates.map(i => {
    const r = wrongRate(i)
    return r === null ? 2 : 1 + r * 3
  })
  let x = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let k = 0; k < candidates.length; k++) {
    x -= weights[k]
    if (x <= 0) return candidates[k]
  }
  return candidates[candidates.length - 1]
}

// 오답 선지는 단어장의 다른 단어 뜻에서 랜덤 — 같은 품사 우선, 뜻 중복 제외
export function makeQuestion(pool, allItems, excludeId) {
  const target = pickWeighted(pool, excludeId)
  const used = new Set([target.meaning])
  const others = shuffle(allItems.filter(i => i.id !== target.id))
  const ordered = [
    ...others.filter(i => i.pos === target.pos),
    ...others.filter(i => i.pos !== target.pos),
  ]
  const distractors = []
  for (const i of ordered) {
    if (distractors.length === 3) break
    if (used.has(i.meaning)) continue
    used.add(i.meaning)
    distractors.push(i.meaning)
  }
  return { target, choices: shuffle([target.meaning, ...distractors]) }
}

// 선지 4개를 만들 수 있는지 (서로 다른 뜻 4개 이상)
export function canQuiz(allItems) {
  return new Set(allItems.map(i => i.meaning)).size >= 4
}
