// 띠배너 Message 필드 텍스트 파싱 유틸 — 순수 함수만 포함(컴포넌트에서 분리해
// react-refresh/only-export-components 경고 방지).

export interface TextSegment {
  text: string;
  bold: boolean;
}

// "*텍스트*"로 감싼 구간만 볼드 처리(별표 자체는 노출하지 않음). 한 메시지에 여러 구간 가능.
export function parseBoldSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), bold: false });
  return segments;
}

// PC용 — "\n" 마커를 줄바꿈이 아닌 공백으로 치환해 항상 한 줄로 표시(마커 텍스트 자체는 노출 안 함)
export function stripExplicitLineMarker(message: string): string {
  return message.replace(/\\n/g, " ");
}

// 모바일용 — 리터럴 "\n"(백슬래시+n) 지점에서만 명시적으로 줄을 나눈다. 자동 줄바꿈 로직이
// 아니라 운영자가 지정한 지점에서만 끊는 방식. 볼드(*...*) 파싱을 전체 메시지 기준으로 먼저
// 수행한 뒤 줄을 나누므로, `*A\nB*`처럼 볼드 구간 안에 줄바꿈 마커가 있어도 두 줄 모두
// 볼드가 정상 유지된다(줄 단위로 먼저 자르고 볼드를 파싱하면 별표 짝이 깨짐).
export function splitLinesPreservingBold(message: string): TextSegment[][] {
  const lines: TextSegment[][] = [[]];
  for (const segment of parseBoldSegments(message)) {
    const parts = segment.text.split(/\\n/);
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part.length > 0) lines[lines.length - 1].push({ text: part, bold: segment.bold });
    });
  }
  return lines;
}
