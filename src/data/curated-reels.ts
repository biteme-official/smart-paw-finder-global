export interface CuratedReel {
  shortcode: string;
  productHandle: string;
}

/**
 * 관리자 큐레이션 릴스 목록
 * 추가 방법: { shortcode: "인스타 shortcode", productHandle: "Shopify 상품 handle" } 객체를 배열에 추가
 * shortcode: https://www.instagram.com/p/[여기]/  에서 대괄호 부분
 */
export const CURATED_REELS: CuratedReel[] = [
  { shortcode: "DYuQjf-SshK", productHandle: "biteme-boong-boong-squirrel-float" },
  { shortcode: "DZeVfveyr6P", productHandle: "biteme-boong-boong-squirrel-float" },
  { shortcode: "DZKJqKDSD5h", productHandle: "biteme-comfort-harness-v2-3-types" },
  { shortcode: "DY6zpSJvvU-", productHandle: "biteme-baking-day-nosework-playbook" },
  { shortcode: "DY6uwpSyKEt", productHandle: "biteme-buddy-bone-nylon-toy" },
  { shortcode: "DYrHKUgN1yb", productHandle: "biteme-farm-nosework-toy" },
];
