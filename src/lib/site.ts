// 사이트 대표 주소. B2C 사이트는 Vercel 환경변수 VITE_SITE_URL로 자기 도메인을 지정하고,
// 값이 없으면 B2B 사이트(biteme.one) 기준으로 동작한다.
export const SITE_URL: string = import.meta.env.VITE_SITE_URL || 'https://biteme.one';

// B2C 사이트(SITE_MODE=b2c)는 일반 소비자 전용 — B2B 가격·할인·신청 메뉴를 쓰지 않는다.
// B2B 사이트 주소 — B2C 사이트에서 도매 계정을 안내할 때 사용
export const B2B_SITE_URL = 'https://biteme.one';

export const IS_B2C_SITE: boolean = import.meta.env.VITE_SITE_MODE === 'b2c';
