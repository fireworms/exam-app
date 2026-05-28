const UNDERLINE_RE = /__(.+?)__/gs;

function renderMarked(text) {
  const parts = [];
  let last = 0;
  const re = new RegExp(UNDERLINE_RE.source, 'gs');
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <u key={match.index} style={{ textUnderlineOffset: '3px', textDecorationThickness: '1.5px' }}>
        {match[1]}
      </u>
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function previewText(text, maxLength) {
  const plain = text.replace(/__(.+?)__/gs, '$1');
  return plain.length > maxLength ? plain.slice(0, maxLength) + '…' : plain;
}

export default function QuestionText({ text, maxLength, style }) {
  if (!text) return null;
  if (maxLength) {
    return (
      <span style={{ whiteSpace: 'pre-wrap', ...style }}>
        {previewText(text, maxLength)}
      </span>
    );
  }
  return (
    <span style={{ whiteSpace: 'pre-wrap', ...style }}>
      {renderMarked(text)}
    </span>
  );
}
