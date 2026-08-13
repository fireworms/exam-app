import { useRef, useState } from "react";

const CUSTOM = "__custom__";

/**
 * 목록 선택 + 직접입력 겸용 필드.
 * 드롭다운에서 "직접입력"을 고르면 텍스트 입력으로 전환된다.
 * 초기 value가 options에 없으면(이전에 직접 입력한 값) 입력 모드로 시작.
 *
 * 스타일은 페이지마다 다르므로 selectStyle/inputStyle로 주입받는다.
 */
export default function SelectOrInput({
  value = "",
  onChange,
  options = [],
  placeholder = "직접 입력",
  emptyLabel = "-- 선택 --",
  customLabel = "✏️ 직접입력",
  selectStyle,
  inputStyle,
}) {
  const [custom, setCustom] = useState(() => !!value && !options.includes(value));
  const inputRef = useRef(null);

  const toCustom = () => {
    setCustom(true);
    onChange("");
    // 렌더 후 포커스
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const toSelect = () => {
    setCustom(false);
    if (!options.includes(value)) onChange("");
  };

  if (custom) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        <input
          ref={inputRef}
          type="text"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={toSelect}
          title="목록에서 선택"
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#f1f5f9",
            color: "#64748b",
            fontSize: 12,
            padding: "0 8px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          목록
        </button>
      </div>
    );
  }

  return (
    <select
      style={selectStyle}
      value={value}
      onChange={(e) => (e.target.value === CUSTOM ? toCustom() : onChange(e.target.value))}
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
      <option value={CUSTOM}>{customLabel}</option>
    </select>
  );
}
