// B2C 어필리에이트 월별 정산 CSV (관리자 /manage/affiliate)
// 기존 관리자 API(admin-orders·admin-partners) 응답만으로 만든다 — api/ 변경 없음.
//
// 확정·지급 상태와 지급일은 api에 추가 예정이다.
// - 상태: 응답의 status 값을 그대로 라벨로 바꾼다. confirmed/paid 등이 오면 자동으로 표시된다.
// - 지급 예정일: 확정 상태일 때만, 주문 응답에 SCHEDULED_PAYOUT_FIELDS 중 하나가 있으면 채운다 (지급 주기 미정 — 계산하지 않음).
// - 실 지급일자: 주문 응답에 PAYOUT_DATE_FIELDS 중 하나가 있으면 채운다.
// - PayPal 수수료·결제번호: 주문 응답에 paypalFee·paypalTransactionId가 있으면 채운다.
// 필드명이 확정되면 위 목록·이름만 맞추면 된다.

export interface SettlementOrder {
  orderName: string;
  createdAt: string;
  code: string;
  baseAmount: number;
  commission: number;
  status: string;
  reason: string | null;
  partnerName?: string;
}

export interface SettlementPartner {
  code: string;
  name: string;
  paypalEmail: string | null;
}

export const SCHEDULED_PAYOUT_FIELDS = ['scheduledPayoutAt', 'expectedPayoutDate'] as const;
export const PAYOUT_DATE_FIELDS = ['paidAt', 'payoutDate'] as const;
// 지급 예정일을 보여주는 상태 (대기·취소·제외는 빈칸)
const SCHEDULED_STATUSES = new Set(['confirmed', 'approved']);

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  confirmed: '확정',
  approved: '확정',
  paid: '지급',
  void: '취소',
  excluded: '제외',
};

const REASON_LABEL: Record<string, string> = {
  self: '본인 구매',
  b2b: 'B2B',
  'partner-suspended': '파트너 정지',
  cancelled: '주문 취소',
  manual: '관리자 무효',
};

const BOM = String.fromCharCode(0xfeff);
const HEADERS = ['어필리에이트 코드', '파트너 이름', 'PayPal 이메일', '주문번호', '주문일(KST)', '주문 금액', '커미션', '상태', '지급 예정일', '실 지급일자', 'PayPal 수수료', 'PayPal 결제번호'];

const kstDate = (value: string) => {
  const t = Date.parse(value);
  return Number.isNaN(t) ? value : new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
};

export function statusLabel(status: string, reason: string | null): string {
  const base = STATUS_LABEL[status] || status;
  return reason ? `${base}(${REASON_LABEL[reason] || reason})` : base;
}

function dateField(order: object, fields: readonly string[]): string {
  const record = order as Record<string, unknown>;
  for (const field of fields) {
    const v = record[field];
    if (typeof v === 'string' && v) return kstDate(v);
  }
  return '';
}

export function scheduledPayoutDate(order: SettlementOrder): string {
  return SCHEDULED_STATUSES.has(order.status) ? dateField(order, SCHEDULED_PAYOUT_FIELDS) : '';
}

export function payoutDate(order: object): string {
  return dateField(order, PAYOUT_DATE_FIELDS);
}

// 숫자 또는 숫자 문자열이면 금액, 아니면 빈칸
export function paypalFee(order: object): number | '' {
  const v = (order as Record<string, unknown>).paypalFee;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : '';
}

export function paypalTransactionId(order: object): string {
  const v = (order as Record<string, unknown>).paypalTransactionId;
  return typeof v === 'string' ? v.trim() : '';
}

// 엑셀이 수식으로 실행하지 않도록 =, +, -, @ 등으로 시작하는 문자열 앞에 ' 를 붙인다 (파트너 이름은 고객 입력값)
function cell(value: string | number): string {
  if (typeof value === 'number') return value.toFixed(2);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildSettlementCsv(orders: SettlementOrder[], partners: SettlementPartner[]): string {
  const byCode = new Map(partners.map((p) => [p.code, p]));
  const rows = [...orders]
    .sort((a, b) => a.code.localeCompare(b.code) || a.createdAt.localeCompare(b.createdAt))
    .map((o) => {
      const p = byCode.get(o.code);
      return [
        o.code,
        o.partnerName || p?.name || '',
        p?.paypalEmail || '',
        o.orderName,
        kstDate(o.createdAt),
        o.baseAmount,
        o.commission,
        statusLabel(o.status, o.reason),
        scheduledPayoutDate(o),
        payoutDate(o),
        paypalFee(o),
        paypalTransactionId(o),
      ].map(cell).join(',');
    });
  // BOM — 엑셀에서 한글이 깨지지 않게
  return `${BOM}${[HEADERS.map(cell).join(','), ...rows].join('\r\n')}\r\n`;
}

// "YYYY-MM" → 그 달 1일 ~ 말일 (KST 날짜 문자열)
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
