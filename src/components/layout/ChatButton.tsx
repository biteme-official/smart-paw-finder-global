import { MessageCircleMore } from "lucide-react";
import { SUPPORT_CHAT_URL, openSupportChat } from "@/lib/support-chat";

// 오른쪽 아래 채팅 버튼 — 글자 없는 바잇미 로고 주황(#FE6100) 원형(PC 56px / 모바일 48px), 새 탭으로 Shopify 채팅 페이지를 연다.
// 위치: "맨 위로 가기" 버튼(ScrollToTop: 40px, 아래 160px·오른쪽 28px)과 가운데 세로줄을 맞추고 16px 간격으로 바로 아래에 둔다.
//   모바일 bottom 96px / PC bottom 88px → 상품 상세·결제 화면의 하단 고정 바(약 81px) 위에 오므로 Buy Now를 가리지 않는다.
export function ChatButton() {
  return (
    <a
      href={SUPPORT_CHAT_URL}
      onClick={openSupportChat}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us"
      title="Chat with us"
      className="fixed bottom-24 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#FE6100] text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#E55700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE6100] focus-visible:ring-offset-2 md:bottom-[5.5rem] md:right-5 md:h-14 md:w-14"
    >
      <MessageCircleMore className="h-6 w-6 md:h-7 md:w-7" aria-hidden="true" />
    </a>
  );
}
