import { AffiliateBannerDesktop } from "./AffiliateBannerDesktop";
import { AffiliateBannerMobile } from "./AffiliateBannerMobile";

// PC/모바일 분리 구조. 뷰포트별로 하나씩만 렌더한다.
export function AffiliateBanner() {
  return (
    <>
      <div className="hidden md:block">
        <AffiliateBannerDesktop />
      </div>
      <div className="md:hidden">
        <AffiliateBannerMobile />
      </div>
    </>
  );
}
