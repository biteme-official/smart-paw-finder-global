// 고객 문의 채팅(Shopify Inbox) 페이지 주소 — 여기 한 곳만 바꾸면 사이트 전체 "Chat with us"가 따라간다.
// Inbox는 자체 프론트에서 직접 열 수 없어서, Shopify 테마의 채팅 전용 페이지(?view=chat)를 새 탭으로 연다.
// 대표 도메인은 shop.biteme-us.com — 주소가 또 바뀌면 Vercel env VITE_SUPPORT_CHAT_URL만 바꾸면 된다.
const DEFAULT_SUPPORT_CHAT_URL = "https://shop.biteme-us.com/?view=chat";

export const SUPPORT_CHAT_URL: string =
  import.meta.env.VITE_SUPPORT_CHAT_URL?.trim() || DEFAULT_SUPPORT_CHAT_URL;
