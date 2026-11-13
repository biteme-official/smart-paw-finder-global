// 어필리에이트 가입 시 받는 정보 (재무 검토: 실명·거주 국가·주소)
// 서버 저장은 api/affiliate-program.ts 작업 후 연결 — 지금은 화면 입력·검증만.

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
