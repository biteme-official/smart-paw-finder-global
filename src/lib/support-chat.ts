import type { MouseEvent } from "react";

// 고객 문의 채팅(Shopify Inbox) 페이지 주소 — 여기 한 곳만 바꾸면 사이트 전체 "Chat with us"가 따라간다.
// Inbox는 자체 프론트에서 직접 열 수 없어서, Shopify 테마의 채팅 전용 페이지(?view=chat)를 PC는 작은 창, 모바일은 새 탭으로 연다.
// 대표 도메인은 shop.biteme-us.com — 주소가 또 바뀌면 Vercel env VITE_SUPPORT_CHAT_URL만 바꾸면 된다.
const DEFAULT_SUPPORT_CHAT_URL = "https://shop.biteme-us.com/?view=chat";

export const SUPPORT_CHAT_URL: string =
  import.meta.env.VITE_SUPPORT_CHAT_URL?.trim() || DEFAULT_SUPPORT_CHAT_URL;

// PC(마우스 쓰는 큰 화면)에서는 새 탭 대신 브라우저 오른쪽 아래에 작은 창으로 띄워 "떠 있는 채팅"처럼 보이게 한다.
// Shopify 채팅 페이지는 다른 사이트 안에 넣을 수 없어서(iframe 차단) 별도 창을 쓴다.
// 모바일이거나 팝업이 막히면 링크 기본 동작(새 탭)으로 연다.
const POPUP_WIDTH = 400;
const POPUP_HEIGHT = 640;

export function openSupportChat(e: MouseEvent<HTMLAnchorElement>) {
  const isDesktop = window.matchMedia("(min-width: 768px) and (pointer: fine)").matches;
  if (!isDesktop) return;

  const left = Math.max(0, window.screenX + window.outerWidth - POPUP_WIDTH - 24);
  const top = Math.max(0, window.screenY + window.outerHeight - POPUP_HEIGHT - 24);
  const popup = window.open(
    SUPPORT_CHAT_URL,
    "biteme-support-chat",
    `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
  );
  if (!popup) return; // 팝업 차단 → 새 탭으로
  popup.opener = null;
  popup.focus();
  e.preventDefault();
}
