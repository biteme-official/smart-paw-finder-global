import { AffiliateBannerDesktop } from "./AffiliateBannerDesktop";

// PC/모바일 분리 구조. 현재 브랜치는 데스크톱만 —
// AffiliateBannerMobile은 별도 PR에서 추가한다 (#108 후속).
export function AffiliateBanner() {
  return (
    <>
      <AffiliateBannerDesktop />
    </>
  );
}
