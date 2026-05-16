export const ORDERED_AREA_KEYS = [
  "public_document_correction",
  "outline_writing",
  "logical_reasoning",
  "strengthen_weaken",
  "nonfiction_inference",
  "common_passage",
  "passage_ordering",
  "awkward_revision",
  "dialogue_analysis",
  "vocabulary_substitution",
  "grammar",
]

export const AREA_LABELS = {
  public_document_correction: "공문서 수정",
  outline_writing: "개요 작성",
  logical_reasoning: "논리 추론",
  strengthen_weaken: "강화/약화 평가",
  nonfiction_inference: "비문학 추론",
  common_passage: "공통 지문 묶음",
  passage_ordering: "글의 흐름 배열",
  awkward_revision: "어색한 부분 수정",
  dialogue_analysis: "대화·견해 분석",
  vocabulary_substitution: "어휘 바꿔쓰기",
  grammar: "문법",
}

export const LEARN_SECTIONS = [
  { path: "/learn", label: "대시보드", icon: "⊞" },
  { path: "/learn/areas", label: "영역별 학습", icon: "□" },
  { path: "/learn/traps", label: "함정 모음", icon: "⚠" },
  { path: "/learn/grammar", label: "문법 기초", icon: "Ω" },
  { path: "/learn/exam-mapping", label: "회차 매핑", icon: "≡" },
  { path: "/learn/priority", label: "학습 우선순위", icon: "★" },
  { path: "/learn/checklist", label: "시험 체크리스트", icon: "✓" },
  { path: "/learn/bookmarks", label: "북마크", icon: "♥" },
]
