import { useEffect, useRef, useState } from "react";

// GEO 상세페이지(업체 변환본: 이미지 + 글자 겹침, 글자 크기는 CSS cqw 로 고정). 원본 HTML은 public/geo/en/{handle}.html 에 둔다.
// 업체 파일의 한국 자사몰 링크는 넣을 때 사이트 상대 주소(/product/...)로 바꾼다.
// 목록에 없는 상품은 기존 Shopify 설명을 쓴다. (없는 파일도 SPA 폴백으로 200이 오므로 목록으로 판단)
export const GEO_DETAIL_HANDLES = new Set([
  "banana-toy",
  "bear-candy-ball-toy-3pcs",
  "bichon-poop-bag-pouch",
  "bite-me-catch-me-tug-fishing-rod-toy-2-types",
  "biteme-all-day-cooling-mat-3-types",
  "biteme-all-day-cooling-pillow",
  "biteme-baking-day-nosework-playbook",
  "biteme-boong-boong-squirrel-float",
  "biteme-braining-spin-and-snack-rabbit-toy",
  "biteme-braining-spin-and-snack-squirrel-toy",
  "biteme-buddy-fork-3colors",
  "biteme-burrito-nosework-toy-squeakycrinklenosework",
  "biteme-catch-me-tug-fishing-rod-toy-3-types",
  "biteme-colorpop-poop-bag-120pcs-1",
  "biteme-comfort-harness-v2-3-types",
  "biteme-comfort-leash-v2-3-types",
  "biteme-dog-oxo-bio-degradable-plastics-poop-bag-ohhh-my-poo-1",
  "biteme-double-heat-padding-v3-solid-3colors",
  "biteme-easy-bite-grip-2colors-1",
  "biteme-farm-friends-ball-toy",
  "biteme-farm-nosework-toy",
  "biteme-good-night-nosework-playbook",
  "biteme-hate-me-band-4-colors",
  "biteme-hate-me-patch-24pcs",
  "biteme-jellybear-led-rechargable-blinker-3-colors",
  "biteme-jellybear-oops-clip-poop-bag-holder-3-colors-1",
  "biteme-jellybear-round-face-comb",
  "biteme-jumping-boogie-auto-ball-toy",
  "biteme-jumping-crab-toy-cover-only",
  "biteme-little-ocean-friends-toy-3pcs",
  "biteme-long-hands-ball-toy-2-types",
  "biteme-lts-laundry-day-nosework-playbook",
  "biteme-mini-silicone-pot",
  "biteme-mini-snack-bottle-4-colors",
  "biteme-mixed-fruits-box-nosework-toy-1",
  "biteme-napa-cabbage-toy",
  "biteme-new-mini-tennis-balls-toy",
  "biteme-peanut-latex-toy-4pcs-1",
  "biteme-pocket-pop-foldable-mesh-bag",
  "biteme-point-care-triangle-slicker",
  "biteme-rainbow-cherry-tomato-latex-toy-4pcs",
  "biteme-roll-up-nosework-toy-2types",
  "biteme-sea-friends-toy-2sets",
  "biteme-slipper-tug-toys-1",
  "biteme-socks-elephant-toy-1",
  "biteme-stubby-friends-toy-giraffe-cow",
  "biteme-vegetable-ball-toy-2sets-1",
  "biteme-yogurt-trio-latex-toy",
  "biteme-zero-guard-silicone-mat-2colors-1",
  "cabbage-toy-1",
  "mini-sports-ball-toy-3pcs",
  "my-birthday-book-nosework-playbook",
  "my-lunch-box-nose-work-playbook",
  "new-foldable-travel-bowl-pastel-4-colors",
  "non-slip-silicone-mat-largegreybeige",
  "non-slip-silicone-mat-standard-greybeige",
  "silicone-pot-6-color-1",
  "socks-nose-work-toy-a-set-of-3-socks-1",
]);

type JsonLdProduct = Record<string, unknown>;

export interface GeoDetailProps {
  handle: string;
  onJsonLd?: (product: JsonLdProduct | null) => void;
  fallback: React.ReactNode;
}

export function GeoDetail({ handle, onJsonLd, fallback }: GeoDetailProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let fontStyle: HTMLStyleElement | null = null;

    (async () => {
      try {
        const res = await fetch(`/geo/en/${handle}.html`);
        if (!res.ok) throw new Error(String(res.status));
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        // 업체 형식 3가지: #bm-detail / .xdetail 로 감싼 본문 / body 바로 아래 본문(스타일이 body·html 기준)
        let src = doc.getElementById("bm-detail") ?? doc.querySelector<HTMLElement>(".xdetail");
        const bodyOnly = !src;
        if (bodyOnly) {
          if (!doc.body.querySelector("main")) throw new Error("bad geo html");
          src = doc.createElement("div");
          src.className = "geo-body";
          src.append(...doc.body.childNodes);
        }
        if (cancelled) return;

        // 글꼴: 이 상품 전용 이름으로 바꿔 문서에 등록(Shadow DOM 안의 @font-face 는 적용 안 됨)
        let css = [...doc.querySelectorAll("style")].map(s => s.textContent || "").join("\n");
        if (bodyOnly) css = css.replace(/(^|[}\s])(html|body)\s*\{/g, "$1.geo-body{");
        const families = [...new Set([...css.matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'/g)].map(m => m[1]))];
        for (const f of families) css = css.split(`'${f}'`).join(`'${f}-${handle}'`);
        const fontFaces = css.match(/@font-face\s*\{[^}]*\}/g) || [];
        fontStyle = document.createElement("style");
        fontStyle.dataset.geoDetail = handle;
        fontStyle.textContent = fontFaces.join("\n");
        document.head.appendChild(fontStyle);

        // 나머지 CSS + 본문은 Shadow DOM 에 넣어 사이트 스타일과 섞이지 않게
        const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
        root.innerHTML = "";
        const style = document.createElement("style");
        style.textContent = css.replace(/@font-face\s*\{[^}]*\}/g, "");
        const detail = document.importNode(src, true) as HTMLElement;
        detail.querySelectorAll("style").forEach(s => s.remove());
        root.append(style, detail);

        const ld = doc.querySelector('script[type="application/ld+json"]')?.textContent;
        if (ld && onJsonLd) {
          const parsed = JSON.parse(ld);
          const product = (parsed["@graph"] || [parsed]).find((n: { "@type"?: string }) => n["@type"] === "Product");
          onJsonLd(product || null);
        }
      } catch (e) {
        console.error("[GeoDetail]", handle, e);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      fontStyle?.remove();
      onJsonLd?.(null);
    };
  }, [handle, onJsonLd]);

  if (failed) return <>{fallback}</>;
  return <div ref={hostRef} className="-mx-4 sm:mx-0" />;
}
