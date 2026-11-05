import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  fetchEmailPopupConfig,
  EMAIL_POPUP_DEFAULTS,
  EMAIL_POPUP_PLACEHOLDER_CODE,
  EmailPopupConfig,
} from "@/lib/shopify";
import { useAuthStore } from "@/stores/authStore";
import biteMeLogo from "@/assets/bite-me-logo.png";

// B2C 첫구매 쿠폰 팝업 (zeoy 설계안 11/4, 아비브식). App에서 IS_B2C_SITE일 때만 렌더링한다.
// 이메일 입력 → Shopify 구독자 등록(api/popup-subscribe, 싱글 옵트인·메일 발송 없음) → 코드 공개.
// 운영값(문구·이미지·대표 상품·쿠폰 코드·노출 기간·초·일수·제외 페이지)은 전부 Shopify 메타객체 email_popup에서 온다.

const STORAGE_KEY = "bm_email_popup_v1";
// 결제 화면을 만들 때 이 저장 칸의 코드가 붙는다 (src/lib/shopify.ts createStorefrontCheckout)
const DISCOUNT_STORAGE_KEY = "affiliate_discount";
const PREVIEW_PARAM = "email_popup_preview";
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PopupStorage {
  revealed?: boolean;
  tab?: boolean;
  hiddenUntil?: number;
}

function readStorage(): PopupStorage {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    // 손상된 값("null", 숫자 등)이면 빈 상태로 본다
    return parsed && typeof parsed === "object" ? (parsed as PopupStorage) : {};
  } catch {
    return {};
  }
}

function writeStorage(next: PopupStorage) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문 동안만 상태 유지
  }
}

function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window !== "undefined" && window.gtag) window.gtag("event", event, params);
}

// 메타객체 문구의 줄바꿈(\n)마다 한 줄로 나누고, 각 줄은 길이를 고르게 나눠 한 단어만 남지 않게 한다
// (white-space: pre-line 안에서는 브라우저가 균형 줄바꿈을 적용하지 않음)
function BalancedLines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block text-balance">
          {line}
        </span>
      ))}
    </>
  );
}

type Step = "form" | "code";
type View = "hidden" | "modal" | "tab";

export function EmailPopup() {
  const { pathname, search } = useLocation();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [config, setConfig] = useState<EmailPopupConfig | null>(null);
  const [view, setView] = useState<View>("hidden");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const viewedRef = useRef(false);

  // 미리보기(?email_popup_preview=1)는 첫 진입 주소로 정하고, 페이지를 옮겨도 미리보기로 유지한다.
  // 미리보기 상태는 메모리에만 두어 테스터 브라우저의 실제 노출 기록을 건드리지 않는다
  const [isPreview] = useState(() => new URLSearchParams(search).get(PREVIEW_PARAM) === "1");
  const previewStoreRef = useRef<PopupStorage>({});
  const read = useCallback(() => (isPreview ? previewStoreRef.current : readStorage()), [isPreview]);
  const write = useCallback(
    (next: PopupStorage) => {
      if (isPreview) previewStoreRef.current = next;
      else writeStorage(next);
    },
    [isPreview],
  );

  // 설정 조회 — 미리보기는 미노출 항목도 그대로 읽어 바로 띄운다. 메타객체를 못 읽으면 기본 문구로
  useEffect(() => {
    if (!isPreview) {
      // 이미 코드를 받았거나 숨김 기간이면 설정을 읽을 필요가 없다
      const stored = readStorage();
      if (stored.revealed || (stored.hiddenUntil && stored.hiddenUntil > Date.now())) return;
    }
    const fallback = { ...EMAIL_POPUP_DEFAULTS, couponCode: EMAIL_POPUP_PLACEHOLDER_CODE, delaySeconds: 0 };
    fetchEmailPopupConfig(isPreview)
      .then((c) => {
        if (c) setConfig(isPreview ? { ...c, delaySeconds: 0 } : c);
        else if (isPreview) setConfig(fallback);
      })
      .catch(() => {
        if (isPreview) setConfig(fallback);
      });
  }, [isPreview]);

  const excluded = !!config && config.excludedPaths.some((p) => pathname.startsWith(p));

  // 노출 판단: 로그인 고객·제외 페이지·이 브라우저에서 이미 코드를 받음·숨김 기간이면 안 띄운다
  useEffect(() => {
    if (!config) return;
    if (view === "modal") {
      // 열린 팝업은 페이지를 옮겨도 유지하되, 로그인하거나 제외 페이지(결제 등)로 가면 닫는다
      if (isLoggedIn || excluded) setView("hidden");
      return;
    }
    const stored = read();
    const blocked =
      isLoggedIn || excluded || stored.revealed || (stored.hiddenUntil && stored.hiddenUntil > Date.now());
    if (blocked) {
      setView("hidden");
      return;
    }
    if (stored.tab) {
      setView("tab");
      return;
    }
    const timer = setTimeout(() => setView("modal"), config.delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [config, isLoggedIn, excluded, read, view]);

  useEffect(() => {
    if (view === "modal" && !viewedRef.current) {
      viewedRef.current = true;
      track("popup_view");
    }
  }, [view]);

  const closeModal = useCallback(() => {
    const stored = read();
    if (step === "code" || stored.revealed) {
      setView("hidden");
      return;
    }
    write({ ...stored, tab: true });
    setView("tab");
  }, [step, read, write]);

  const openFromTab = () => {
    track("popup_tab_open");
    setError(null);
    setStep("form");
    setView("modal");
  };

  const hideTab = () => {
    if (!config) return;
    write({ hiddenUntil: Date.now() + config.hideDays * DAY_MS });
    setView("hidden");
  };

  // 이메일을 Shopify 구독자로 등록(api/popup-subscribe)한 뒤 코드를 보여준다. 미리보기에서도 실제로 등록된다
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/popup-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, website: honeypot }),
      });
      if (res.status === 400) {
        setError("Enter a valid email address.");
        return;
      }
      if (res.status === 429) {
        setError("Please try again in a minute.");
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }
      write({ revealed: true });
      track("popup_submit");
      // 코드를 복사하지 않고 닫아도 결제에 붙도록 공개 시점에 바로 저장한다 (팝업은 이 브라우저에서 다시 안 뜸)
      applyCode();
      setStep("code");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // 팝업 코드를 결제용 저장 칸에 넣는다. 반환값: 결제에 자동으로 붙는지 여부
  const applyCode = (): boolean => {
    if (!config) return false;
    // 자리표시 코드는 결제에 붙이지 않는다 (미리보기 전용)
    if (config.couponCode === EMAIL_POPUP_PLACEHOLDER_CODE) return false;
    // 할인 링크(/discount/코드)로 받은 다른 코드가 있으면 덮어쓰지 않는다 — 파트너 할인·귀속 보호
    let existing: string | null = null;
    try {
      existing = localStorage.getItem(DISCOUNT_STORAGE_KEY);
    } catch {
      // 무시
    }
    if (existing && existing.toUpperCase() !== config.couponCode) return false;
    try {
      localStorage.setItem(DISCOUNT_STORAGE_KEY, config.couponCode);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopy = () => {
    if (!config) return;
    track("popup_coupon_copy");
    // 클립보드는 결과를 기다리지 않는다 — 브라우저가 응답하지 않아도 안내·결제 적용은 진행
    navigator.clipboard?.writeText(config.couponCode).catch(() => {});
    // 다른 코드가 이미 저장돼 자동 적용이 안 되면, 결제 화면에 직접 넣으라고 정확히 안내한다
    if (applyCode()) toast.success("Your code will be applied at checkout");
    else toast.success("Code copied. Enter it at checkout.");
  };

  if (!config || view === "hidden") return null;

  const title = config.title.split("{pct}").join(config.discountLabel);
  const successTitle = config.successTitle.split("{pct}").join(config.discountLabel);

  if (view === "tab") {
    return (
      // 오른쪽 세로 탭 — zeoy 목업 배치(PC 위에서 37.5%, 40×132, ✕는 탭 왼쪽 아래 모서리). 색은 검정(11/5 상아).
      // 모바일은 화면 오른쪽 세로 가운데 (11/5 상아)
      // 홈 콘텐츠 박스(max-w 1600px, Index.tsx)보다 화면이 넓으면 화면 끝이 아니라 박스 오른쪽 선(배너 끝)에 맞춘다
      <div className="fixed right-[max(0px,calc((100%-1600px)/2))] top-1/2 z-[60] -translate-y-1/2 md:top-[37.5%] md:translate-y-0">
        <button
          type="button"
          onClick={openFromTab}
          className="flex h-28 w-9 items-center justify-center rounded-l-[10px] bg-neutral-900 text-xs font-extrabold tracking-wider text-white shadow-md [writing-mode:vertical-rl] md:h-[132px] md:w-10 md:text-[13px]"
        >
          {config.discountLabel} OFF
        </button>
        <button
          type="button"
          onClick={hideTab}
          aria-label="Hide offer"
          className="absolute -bottom-3 -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white shadow ring-2 ring-white hover:bg-neutral-700"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const hasPcImage = !!config.pcImage;
  const shopHref = config.productHandle ? `/product/${config.productHandle}` : "/";

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) closeModal(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={`fixed inset-x-0 bottom-0 z-[70] flex max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white text-neutral-900 shadow-2xl outline-none md:inset-auto md:left-1/2 md:top-1/2 md:max-w-[calc(100vw-32px)] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-2xl ${hasPcImage ? "md:w-[800px]" : "md:w-[440px]"}`}
        >
          {/* 왼쪽 이미지 — 소재 한 장을 꽉 채운다. 메타객체에 배지·제목·버튼 문구가 있으면 사진 위에 얹고
              (zeoy 목업), 비워두면 이미지만 (글자가 그려진 소재용). 이미지가 없으면 칸을 빼고 폼만 */}
          {config.pcImage && (
            <div className="relative hidden min-h-[520px] w-1/2 flex-none md:block">
              <img
                src={config.pcImage.url}
                alt={config.pcImage.altText || ""}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {(config.imageBadge || config.imageHeadline) && (
                <div className="relative flex flex-col gap-3 p-6">
                  {config.imageBadge && (
                    <span className="self-start rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">
                      {config.imageBadge}
                    </span>
                  )}
                  {config.imageHeadline && (
                    <span className="text-[26px] font-extrabold uppercase leading-tight">
                      <BalancedLines text={config.imageHeadline} />
                    </span>
                  )}
                </div>
              )}
              {config.imageButton && (
                <Link
                  to={shopHref}
                  onClick={closeModal}
                  className="absolute inset-x-0 bottom-0 flex h-11 items-center justify-center bg-neutral-900 text-xs font-bold tracking-widest text-white"
                >
                  {config.imageButton}
                </Link>
              )}
            </div>
          )}

          <div className="flex w-full flex-col items-center gap-4 px-6 pb-8 pt-10 text-center md:flex-1 md:justify-center md:px-10 md:py-12">
            {config.mobileImage && (
              <img
                src={config.mobileImage.url}
                alt={config.mobileImage.altText || ""}
                className="max-h-44 w-full rounded-lg object-cover md:hidden"
              />
            )}
            <img src={biteMeLogo} alt="BITE ME" className="mb-2 h-[22px] md:mb-4 md:h-[26px]" />

            {step === "form" ? (
              <>
                <DialogPrimitive.Title className="text-xl font-extrabold leading-snug md:text-[26px]">
                  <BalancedLines text={title} />
                </DialogPrimitive.Title>
                <p className="text-balance text-sm leading-relaxed text-neutral-700">{config.subtitle}</p>
                <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-3">
                  <label htmlFor="email-popup-email" className="sr-only">Email address</label>
                  <input
                    id="email-popup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="h-14 w-full bg-neutral-200/70 px-5 text-base outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                  {/* 봇 차단용 숨김 칸 — 사람은 보지 못한다 */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="hidden"
                    aria-hidden="true"
                  />
                  {error && <p className="text-left text-xs text-red-600">{error}</p>}
                  <p className="text-xs text-neutral-700">By signing up, you agree to receive email marketing.</p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-12 w-full bg-neutral-900 text-sm font-bold tracking-[0.12em] text-white disabled:opacity-60"
                  >
                    {submitting ? "JOINING..." : "JOIN US & SAVE"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <DialogPrimitive.Title className="text-xl font-extrabold leading-snug md:text-[26px]">
                  <BalancedLines text={successTitle} />
                </DialogPrimitive.Title>
                <p className="text-balance text-sm leading-relaxed text-neutral-700">{config.successMessage}</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-16 w-full items-center justify-center gap-4 rounded-md border-[3px] border-dotted border-neutral-900 text-xl font-extrabold tracking-wide"
                  aria-label={`Copy code ${config.couponCode}`}
                >
                  {config.couponCode}
                  <Copy className="h-6 w-6" aria-hidden="true" />
                </button>
                <p className="text-xs text-neutral-600">{config.codeNote}</p>
                <Link
                  to={shopHref}
                  onClick={() => { handleCopy(); closeModal(); }}
                  className="flex h-12 w-full items-center justify-center rounded-md bg-neutral-900 text-sm font-bold tracking-[0.12em] text-white"
                >
                  SHOP NOW
                </Link>
              </>
            )}
          </div>

          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
