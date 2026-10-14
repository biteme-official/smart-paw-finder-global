// 사이트 대표 주소. B2C 사이트는 Vercel 환경변수 VITE_SITE_URL로 자기 도메인을 지정하고,
// 값이 없으면 B2B 사이트(biteme.one) 기준으로 동작한다.
export const SITE_URL: string = import.meta.env.VITE_SITE_URL || 'https://biteme.one';
