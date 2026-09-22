// 띠배너 Message 필드 텍스트 파싱 유틸 — 순수 함수만 포함(컴포넌트에서 분리해
// react-refresh/only-export-components 경고 방지).

export interface TextSegment {
  text: string;
  bold: boolean;
}

// "*텍스트*"로 감싼 구간만 볼드 처리(별표 자체는 노출하지 않음). 한 메시지에 여러 구간 가능.
// [\s\S] + dotAll 대신 사용 — 마커가 실제 개행문자로 치환된 뒤에도(applyExplicitLineMarker)
// 볼드 구간 안에 개행이 섞여 있으면 정상 매칭되어야 하므로 줄바꿈도 매칭 대상에 포함한다.
export function parseBoldSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*([\s\S]+?)\*/g;
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

// "\n" 마커 지점만 강제 줄바꿈되고, 그 외에는 화면 폭에 따라 자동 줄바꿈 허용(PC/모바일 공통)
// — 리터럴 "\n"을 실제 개행문자로 치환한다. `whitespace-pre-line`과 함께 쓰면 이 개행 지점은
// 반드시 줄이 바뀌고, 나머지 구간은 폭에 맞춰 자연스럽게 자동 줄바꿈된다.
export function applyExplicitLineMarker(message: string): string {
  return message.replace(/\\n/g, "\n");
}
