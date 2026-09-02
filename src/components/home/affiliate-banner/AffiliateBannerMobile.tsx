import { Link } from "react-router-dom";
import { Camera, ArrowRight } from "lucide-react";

// 모바일 전용: 데스크톱 배너를 한 줄로 압축한다. 아이콘/여백을 줄이고
// 부제는 "Earn 10% commission →" 한 줄로, "Join Now" 필 버튼은 생략한다.
export function AffiliateBannerMobile() {
  return (
    <section className="mt-6 px-4">
      <Link
        to="/affiliate"
        className="group flex items-center gap-2 rounded-2xl bg-orange-500 px-3 py-2.5 text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Camera className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
            FOR CREATORS
          </span>
          <span className="mt-0.5 block text-xs font-extrabold leading-snug">
            Love BITE ME? Earn With Us! 🐾
          </span>
          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-white/95">
            Earn 10% commission <ArrowRight className="h-3 w-3" />
          </span>
        </span>
      </Link>
    </section>
  );
}
