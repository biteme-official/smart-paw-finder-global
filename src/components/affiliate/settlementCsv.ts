// B2C 어필리에이트 CSV (관리자 /manage/affiliate) — 재무 회신 양식(affiliate-settlement-2026-10_SAMPLE) 기준
//
// ① 월별 정산 CSV (주문 1건 = 1줄, 고른 달 = KST 주문일)
// - 지급 예정일: 확정·지급 주문만 — 확정된 달의 다음 달 15일 (월말 마감 → 익월 15일, 약관 5번)
//   그 날이 지났는데 아직 확정(미지급)이면 이월 — 상태에 이유를 붙이고 예정일을 다음 지급일로 민다
// - 실 지급일자: 주문의 paidAt (Mark as paid / PayPal 송금 시각)
// - PayPal 수수료·결제번호: 주문이 들어간 송금 기록(payoutId)에서. 수수료는 송금 1건에 붙으므로
//   그 송금의 첫 주문 줄에만 적는다 (줄마다 적으면 합계가 부풀어 오른다)
// - 실명(Legal name): 파트너 profile.firstName·lastName을 "이름 성" 순서로. 없으면(11/24 이전 가입자) 빈칸
//
// ② 송금 내역 CSV (송금 1건 = 파트너 1명 × 마감 월 = 1줄, 고른 달 = KST 송금일) — 실제 나간 돈·수수료·차감

export interface SettlementOrder {
  orderId?: string;
  orderName: string;
  createdAt: string;
  code: string;
  baseAmount: number;
  commission: number;
  status: string;
  reason: string | null;
  partnerName?: string;
  confirmedAt?: string | null;
  paidAt?: string | null;
  payoutId?: string | null;
}

// 송금 기록 (api admin-payout-list)
export interface SettlementPayout {
  id: string;
  code: string;
  partnerName: string;
  profile?: { firstName?: string; lastName?: string } | null;
  period: string;
  amount: number;
  paypalEmail: string;
  paidAt: string;
  orderIds: string[];
  commissionTotal: number;
  adjustmentTotal: number;
  method?: 'manual' | 'paypal';
  paypalStatus?: string;
  paypalFee?: number | null;
  paypalTransactionId?: string | null;
  revertedAt?: string | null; // 송금 실패로 지급 취소 — 주문은 다시 확정 상태
}

export interface SettlementPartner {
  code: string;
  name: string;
  status?: string; // active | suspended | left | removed
  test?: boolean; // 테스트 파트너 — CSV에서 뺀다
  paypalEmail: string | null;
  profile?: { firstName?: string; lastName?: string } | null;
}

// "이름 성" — profile이 없으면 빈 문자열
function legalName(p: SettlementPartner['profile']): string {
  return [p?.firstName, p?.lastName].map((v) => (v || '').trim()).filter(Boolean).join(' ');
}

// 지급 예정일을 보여주는 상태 (대기·취소·제외는 빈칸) — 재무 샘플처럼 지급된 주문도 예정일을 남긴다
const SCHEDULED_STATUSES = new Set(['confirmed', 'paid']);
const PAY_DAY = 15;

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
  clawback: '지급 후 차감',
};

const BOM = String.fromCharCode(0xfeff);
const HEADERS = ['어필리에이트 코드', '파트너 이름', '실명(Legal name)', 'PayPal 이메일', '주문번호', '주문일(KST)', '주문 금액', '커미션', '상태', '지급 예정일', '실 지급일자', 'PayPal 수수료', 'PayPal 결제번호'];

const kstDate = (value: string) => {
  const t = Date.parse(value);
  return Number.isNaN(t) ? value : new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
};

export function statusLabel(status: string, reason: string | null): string {
  const base = STATUS_LABEL[status] || status;
  return reason ? `${base}(${REASON_LABEL[reason] || reason})` : base;
}

// 확정된 달(KST)의 다음 달 15일
export function scheduledPayoutDate(order: SettlementOrder): string {
  if (!SCHEDULED_STATUSES.has(order.status) || !order.confirmedAt) return '';
  const [y, m] = kstDate(order.confirmedAt).split('-').map(Number);
  if (!y || !m) return '';
  return new Date(Date.UTC(y, m, PAY_DAY)).toISOString().slice(0, 10);
}

// 오늘(KST) 이후 첫 지급일 — 오늘이 15일 이전이면 이번 달 15일, 지났으면 다음 달 15일
function nextPayDay(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, d <= PAY_DAY ? m - 1 : m, PAY_DAY)).toISOString().slice(0, 10);
}

// 예정일이 지났는데 아직 확정(미지급)인 주문 — 이유와 다음 지급일 (관리자 지급 패널의 판정과 같은 기준)
function carryOver(order: SettlementOrder, partner: SettlementPartner | undefined, today: string): { reason: string; date: string } | null {
  const due = scheduledPayoutDate(order);
  if (order.status !== 'confirmed' || !due || due >= today) return null;
  if (partner?.status === 'removed') return { reason: '미지급: 부정 제거', date: '' };
  if (partner?.status === 'suspended') return { reason: '보류: 파트너 정지', date: '' };
  if (!partner?.paypalEmail) return { reason: '이월: PayPal 없음', date: nextPayDay(today) };
  if (partner.status === 'left') return { reason: '이월', date: nextPayDay(today) };
  return { reason: '이월: $20 미만', date: nextPayDay(today) };
}

export function payoutDate(order: SettlementOrder): string {
  return order.paidAt ? kstDate(order.paidAt) : '';
}

// 엑셀이 수식으로 실행하지 않도록 =, +, -, @ 등으로 시작하는 문자열 앞에 ' 를 붙인다 (파트너 이름은 고객 입력값)
function cell(value: string | number): string {
  if (typeof value === 'number') return value.toFixed(2);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildSettlementCsv(
  orders: SettlementOrder[],
  partners: SettlementPartner[],
  payouts: SettlementPayout[],
  today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
): string {
  const byCode = new Map(partners.map((p) => [p.code, p]));
  const byPayout = new Map(payouts.map((x) => [x.id, x]));
  const feeWritten = new Set<string>();
  const rows = orders
    .filter((o) => !byCode.get(o.code)?.test)
    .sort((a, b) => a.code.localeCompare(b.code) || a.createdAt.localeCompare(b.createdAt))
    .map((o) => {
      const p = byCode.get(o.code);
      const pay = o.payoutId ? byPayout.get(o.payoutId) : undefined;
      // 수수료는 송금 건당 — 그 송금의 첫 주문 줄에만 (송금이 여러 주문월에 걸쳐도 월별 CSV를 합칠 때 두 번 세지 않게)
      const firstOfPayout = pay ? (o.orderId ? pay.orderIds[0] === o.orderId : !feeWritten.has(pay.id)) : false;
      const fee = pay && pay.paypalFee != null && firstOfPayout ? pay.paypalFee : '';
      if (pay) feeWritten.add(pay.id);
      const carried = carryOver(o, p, today);
      return [
        o.code,
        o.partnerName || p?.name || '',
        legalName(p?.profile),
        p?.paypalEmail || '',
        o.orderName,
        kstDate(o.createdAt),
        o.baseAmount,
        o.commission,
        carried ? `확정(${carried.reason})` : statusLabel(o.status, o.reason),
        carried ? carried.date : scheduledPayoutDate(o),
        payoutDate(o),
        fee,
        pay?.paypalTransactionId || '',
      ].map(cell).join(',');
    });
  // BOM — 엑셀에서 한글이 깨지지 않게
  return `${BOM}${[HEADERS.map(cell).join(','), ...rows].join('\r\n')}\r\n`;
}

const PAYOUT_HEADERS = [
  '송금일(KST)', '어필리에이트 코드', '파트너 이름', '실명(Legal name)', 'PayPal 이메일', '대상 확정 월', '주문 수',
  '커미션 합계', '지급 후 차감', '송금액', 'PayPal 수수료', 'PayPal 결제번호', '송금 방법', '송금 상태',
];

// ② 송금 내역 — 송금액 = 커미션 합계 + 차감(음수). 수수료는 회사 부담(약관 5번)이라 송금액에 포함하지 않는다
export function buildPayoutCsv(payouts: SettlementPayout[]): string {
  const rows = [...payouts]
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    .map((x) => [
      kstDate(x.paidAt),
      x.code,
      x.partnerName,
      legalName(x.profile),
      x.paypalEmail,
      x.period,
      String(x.orderIds.length),
      x.commissionTotal,
      x.adjustmentTotal,
      x.amount,
      x.paypalFee ?? '',
      x.paypalTransactionId || '',
      x.method === 'paypal' ? 'PayPal 송금' : '수동(Mark as paid)',
      x.method === 'paypal' ? `${x.paypalStatus || ''}${x.revertedAt ? ' · 지급 취소(다음 지급 대상)' : ''}` : '',
    ].map(cell).join(','));
  return `${BOM}${[PAYOUT_HEADERS.map(cell).join(','), ...rows].join('\r\n')}\r\n`;
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
