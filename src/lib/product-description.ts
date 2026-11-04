// 상품 설명(Shopify)에 남아 있는 카피 작성용 템플릿 제목을 보여줄 때만 정리한다. Shopify 원본은 그대로.
// 같은 규칙이 api/product-feed.ts, api/shopify.ts 에도 있다 — 바꿀 때 같이 바꿀 것.

// [템플릿 제목, 바꿀 제목($1 = 브랜드명 등)] — 바꿀 제목이 ''이면 제목을 지운다
const HEADING_RULES: [RegExp, string][] = [
  [/^The Hero Hook$/i, ''],
  [/^The "Why" Section$/i, 'Why It Matters'],
  [/^The 3 Core Pillars(\s*\(Features\))?$/i, 'Key Features'],
  [/^\\?"Why ([^"\\]+?)\?\\?"\s*\(The Brand Story\)$/i, 'Why $1?'],
  [/^Scannable Product Specs$/i, 'Specifications'],
];

const decode = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();

// 상세 화면용: h2 제목 앞 번호(2. 3. …)를 지우고 템플릿 제목을 바꾸거나 지운다
export function cleanDescriptionHtml(html: string): string {
  return html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_m, attrs: string, inner: string) => {
    const text = decode(inner).replace(/^\d+\.\s*/, '');
    const rule = HEADING_RULES.find(([re]) => re.test(text));
    if (rule) return rule[1] ? `<h2${attrs}>${text.replace(rule[0], rule[1])}</h2>` : '';
    return `<h2${attrs}>${inner.replace(/^((?:\s|<[^>]+>)*)\d+\.\s*/, '$1')}</h2>`;
  });
}

// 검색 설명·구조화 데이터용(줄바꿈 없는 글): 템플릿 제목을 바꾸거나 지운다
const TEXT_RULES: [RegExp, string][] = [
  [/(\b\d+\.\s*)?The Hero Hook\s*/g, ''],
  [/(\b\d+\.\s*)?The "Why" Section/g, 'Why It Matters'],
  [/(\b\d+\.\s*)?The 3 Core Pillars(\s*\(Features\))?/g, 'Key Features'],
  [/(\b\d+\.\s*)?\\?"Why ([^"\\]+?)\?\\?"\s*\(The Brand Story\)/g, 'Why $2?'],
  [/(\b\d+\.\s*)?Scannable Product Specs/g, 'Specifications'],
  [/\b\d+\.\s*(?=About This Product|Quality & Safety Evidence)/g, ''],
];

export function cleanDescriptionText(text: string): string {
  return TEXT_RULES.reduce((s, [re, to]) => s.replace(re, to), text);
}
