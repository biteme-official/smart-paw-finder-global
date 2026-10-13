// Phone numbers in the sheet: "+<country calling code> <digits>", e.g. "+1 5105577841", "+65 96413200".

/** ITU country calling codes by ISO alpha-2 (without "+"). */
export const CALLING_CODES: Record<string, string> = {
  US: '1', CA: '1', PR: '1', BS: '1', BB: '1', AG: '1', AI: '1', BM: '1', DM: '1', DO: '1', GD: '1', GU: '1',
  JM: '1', KN: '1', KY: '1', LC: '1', MP: '1', MS: '1', TC: '1', TT: '1', VC: '1', VG: '1',
  RU: '7', KZ: '7',
  EG: '20', ZA: '27', GR: '30', NL: '31', BE: '32', FR: '33', ES: '34', HU: '36', IT: '39', VA: '39',
  RO: '40', CH: '41', AT: '43', GB: '44', GG: '44', JE: '44', IM: '44', DK: '45', SE: '46', NO: '47', PL: '48', DE: '49',
  PE: '51', MX: '52', CU: '53', AR: '54', BR: '55', CL: '56', CO: '57', VE: '58',
  MY: '60', AU: '61', ID: '62', PH: '63', NZ: '64', SG: '65', TH: '66',
  JP: '81', KR: '82', VN: '84', CN: '86', TR: '90', IN: '91', PK: '92', AF: '93', LK: '94', MM: '95', IR: '98',
  SS: '211', MA: '212', EH: '212', DZ: '213', TN: '216', LY: '218', GM: '220', SN: '221', MR: '222', ML: '223',
  GN: '224', CI: '225', BF: '226', NE: '227', TG: '228', BJ: '229', MU: '230', LR: '231', SL: '232', GH: '233',
  NG: '234', TD: '235', CF: '236', CM: '237', CV: '238', ST: '239', GQ: '240', GA: '241', CG: '242', CD: '243',
  AO: '244', GW: '245', IO: '246', SC: '248', SD: '249', RW: '250', ET: '251', SO: '252', DJ: '253', KE: '254',
  TZ: '255', UG: '256', BI: '257', MZ: '258', ZM: '260', MG: '261', RE: '262', YT: '262', ZW: '263', NA: '264',
  MW: '265', LS: '266', BW: '267', SZ: '268', KM: '269', SH: '290', ER: '291', AW: '297', GL: '299',
  GI: '350', PT: '351', LU: '352', IE: '353', IS: '354', AL: '355', MT: '356', CY: '357', FI: '358', BG: '359',
  LT: '370', LV: '371', EE: '372', MD: '373', AM: '374', BY: '375', AD: '376', MC: '377', SM: '378',
  UA: '380', RS: '381', ME: '382', XK: '383', HR: '385', SI: '386', BA: '387', MK: '389', CZ: '420', SK: '421',
  LI: '423', BZ: '501', GT: '502', SV: '503', HN: '504', NI: '505', CR: '506', PA: '507', PM: '508', HT: '509',
  GP: '590', BO: '591', GY: '592', EC: '593', GF: '594', PY: '595', MQ: '596', SR: '597', UY: '598', AN: '599',
  TL: '670', AQ: '672', BN: '673', NR: '674', PG: '675', TO: '676', SB: '677', VU: '678', FJ: '679', PW: '680',
  WF: '681', CK: '682', NU: '683', WS: '685', KI: '686', NC: '687', TV: '688', PF: '689', FM: '691', MH: '692',
  PN: '64', HK: '852', MO: '853', KH: '855', LA: '856', BD: '880', TW: '886', MV: '960', LB: '961', JO: '962',
  SY: '963', IQ: '964', KW: '965', SA: '966', YE: '967', OM: '968', PS: '970', AE: '971', IL: '972', BH: '973',
  QA: '974', BT: '975', MN: '976', NP: '977', TJ: '992', TM: '993', AZ: '994', GE: '995', KG: '996', UZ: '998',
};

const ALL_CODES = [...new Set(Object.values(CALLING_CODES))].sort((a, b) => b.length - a.length);

// Calling codes whose national numbers keep the leading 0 (Italy / Vatican, San Marino).
const KEEPS_TRUNK_ZERO = new Set(['39', '378']);

/** Number after the calling code without the domestic trunk 0 ("+44 07700..." → "7700..."), except where it is kept. */
const withoutTrunkZero = (rest: string, callingCode: string) =>
  (!KEEPS_TRUNK_ZERO.has(callingCode) && rest.startsWith('0') ? rest.slice(1) : rest);

export interface NormalizedPhone {
  /** "+65 91596654"; the input with separators removed when it can't be normalized. */
  value: string;
  /** The number carries a calling code that isn't the selected country's. */
  mismatch: boolean;
}

/**
 * "+15105577841" (US) → "+1 5105577841", "6591596654" (SG) → "+65 91596654",
 * "+62 813-1109-3329" (ID) → "+62 81311093329", "91596654" (SG) → "+65 91596654",
 * "+44 07700 900123" (GB) → "+44 7700900123".
 */
export function normalizePhone(raw: string, countryCode: string): NormalizedPhone {
  const text = raw.trim();
  if (!text) return { value: '', mismatch: false };
  const international = text.startsWith('+') || /^00[1-9]/.test(text);
  let digits = text.replace(/\D/g, '');
  if (!international && /^00[1-9]/.test(digits)) digits = digits.slice(2);
  if (international && text.startsWith('00')) digits = digits.slice(2);
  if (!digits) return { value: text, mismatch: false };

  const own = CALLING_CODES[countryCode];
  if (international) {
    if (own && digits.startsWith(own)) {
      return { value: `+${own} ${withoutTrunkZero(digits.slice(own.length), own)}`, mismatch: false };
    }
    const other = ALL_CODES.find((c) => digits.startsWith(c));
    if (other) return { value: `+${other} ${withoutTrunkZero(digits.slice(other.length), other)}`, mismatch: !!own };
    return { value: `+${digits}`, mismatch: !!own };
  }
  if (!own) return { value: digits, mismatch: false };
  // Calling code typed without "+" ("6591596654"): only when enough digits remain for a number.
  if (digits.startsWith(own) && digits.length - own.length >= 7) {
    return { value: `+${own} ${withoutTrunkZero(digits.slice(own.length), own)}`, mismatch: false };
  }
  // National format: "0813..." → "+62 813...".
  return { value: `+${own} ${withoutTrunkZero(digits, own)}`, mismatch: false };
}

/** Typed with a calling code ("+65 ...", "0065 ..."), as opposed to one added from the selected country. */
export const hasCallingCode = (raw: string) => /^(?:\+|00[1-9])/.test(raw.trim());

// Digits after the calling code for the countries shipped to most; others use the E.164-ish 6–12 range.
const NATIONAL_LENGTHS: Record<string, [number, number]> = {
  SG: [8, 8], HK: [8, 8], MO: [8, 8], US: [10, 10], CA: [10, 10], MY: [9, 10], PH: [10, 10], ID: [9, 12],
  // KR / TH: Seoul / Bangkok landlines (02-123-4567) have 8 digits after the code.
  TH: [8, 9], VN: [9, 10], TW: [9, 9], JP: [9, 10], KR: [8, 10], AU: [9, 9], NZ: [8, 10], GB: [10, 10],
  CN: [11, 11], IN: [10, 10], AE: [9, 9],
};

/**
 * Why a phone number needs a look before shipping ('' when it looks fine). Nothing is changed:
 * empty, letters or symbols mixed in, no calling code typed (`codeAdded`: the screen added the
 * selected country's), a calling code that isn't the country's, or too few / too many digits.
 */
export function phoneIssue(raw: string, countryCode: string, codeAdded = false): string {
  const text = raw.trim();
  if (!text) return '전화번호 없음';
  if (!/^[+\d\s().-]+$/.test(text)) return '숫자 외 글자 포함';
  const { value, mismatch } = normalizePhone(text, countryCode);
  if (codeAdded || !value.startsWith('+')) return '국가 코드 없음';
  if (mismatch) return '국가 코드가 선택한 국가와 다름';
  const national = value.split(' ')[1] ?? '';
  const [min, max] = NATIONAL_LENGTHS[countryCode] ?? [6, 12];
  if (national.length < min || national.length > max) return '자릿수 확인';
  return '';
}
