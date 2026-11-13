// 어필리에이트 가입 시 받는 정보 (재무 검토: 실명·거주 국가·주소)
// 서버 저장은 api/affiliate-program.ts 작업 후 연결(PR #199 요청) — 지금은 화면 입력·검증만.
// 기존 가입자는 profile·W-9가 없다 — 표시하는 곳은 모두 비어 있어도 동작해야 한다.

export interface AffiliateJoinProfile {
  firstName: string;
  lastName: string;
  country: string; // ISO 3166-1 alpha-2
  address1: string;
  address2: string;
  city: string;
  province: string;
  zip: string;
}

export const EMPTY_JOIN_PROFILE: AffiliateJoinProfile = {
  firstName: '', lastName: '', country: '', address1: '', address2: '', city: '', province: '', zip: '',
};

export const PROFILE_MAX_LENGTH = 100;

const REQUIRED: (keyof AffiliateJoinProfile)[] = ['firstName', 'lastName', 'country', 'address1', 'city'];

export function isJoinProfileComplete(p: AffiliateJoinProfile): boolean {
  return REQUIRED.every((k) => p[k].trim().length > 0) && Object.values(p).every((v) => v.length <= PROFILE_MAX_LENGTH);
}

export function trimJoinProfile(p: AffiliateJoinProfile): AffiliateJoinProfile {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.trim()])) as unknown as AffiliateJoinProfile;
}

// 실명 표시 (관리자 화면·정산 CSV). 기존 가입자처럼 profile이 없으면 빈 문자열
export function legalName(p: { firstName?: string; lastName?: string } | null | undefined): string {
  return [p?.firstName, p?.lastName].map((v) => (v || '').trim()).filter(Boolean).join(' ');
}

// ─── W-9 (거주 국가 US만, 선택) ───────────────────────────────────────────────
// 납세자번호가 들어가는 파일 — 서버가 Google 공유 드라이브 제한 폴더에 보관하고 관리자만 열람한다.
// 여기서는 화면 단계 검사만 한다. 서버도 같은 기준(형식·크기·파일 서명)으로 다시 검사해야 한다.

export const W9_COUNTRY = 'US';
export const W9_MAX_BYTES = 3 * 1024 * 1024; // base64(+33%)로 보내도 Vercel 요청 한도 4.5MB 안
export const W9_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';
export type W9MimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

// 확장자·브라우저 type 대신 파일 앞부분 서명으로 실제 형식을 판단
function sniffMime(head: Uint8Array): W9MimeType | null {
  const starts = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46])) return 'application/pdf'; // %PDF
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  return null;
}

export type W9CheckResult = { ok: true; mimeType: W9MimeType } | { ok: false; error: string };

export async function checkW9File(file: File): Promise<W9CheckResult> {
  if (file.size === 0) return { ok: false, error: 'This file is empty.' };
  if (file.size > W9_MAX_BYTES) return { ok: false, error: 'File must be 3 MB or smaller.' };
  const mimeType = sniffMime(new Uint8Array(await file.slice(0, 8).arrayBuffer()));
  if (!mimeType) return { ok: false, error: 'Upload a PDF, JPG or PNG file.' };
  return { ok: true, mimeType };
}

// 업로드용 base64 (data: 접두어 없이)
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ISO 3166-1 alpha-2 — 이름은 브라우저 Intl로 영어 표기
const CODES = (
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

let cached: { code: string; name: string }[] | null = null;

export function countryOptions(): { code: string; name: string }[] {
  if (cached) return cached;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    names = null;
  }
  const list = CODES.map((code) => ({ code, name: names?.of(code) || code })).sort((a, b) => a.name.localeCompare(b.name));
  // 미국 거주 파트너가 대부분이라 맨 위에
  const us = list.findIndex((c) => c.code === 'US');
  if (us > 0) list.unshift(...list.splice(us, 1));
  cached = list;
  return list;
}
