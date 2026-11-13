/**
 * 재입고 이메일 알림 신청 (#202) — 서버는 api/restock.ts
 *
 *   - RestockCardButton    목록 카드 — 「SOLD OUT」 아래 「Notify me」
 *   - RestockDetailButton  상품 상세 하단 — 고른 옵션이 품절일 때 장바구니·구매 버튼 자리
 *   - RestockDialog        이메일 입력 + (품절 옵션이 여럿이면) 옵션 고르기
 *
 * 신청한 옵션은 이 브라우저에 기억해 「Requested」로 보여준다(서버도 중복 신청은 한 건으로 친다).
 */
import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

export interface RestockVariant {
  id: string;
  title: string;
}

export interface RestockProduct {
  handle: string;
  title: string;
  /** 품절인 옵션들 */
  soldOutVariants: RestockVariant[];
}

const STORAGE_KEY = "restock-requested";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readRequested(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function rememberRequested(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...readRequested(), ...ids])]));
  } catch {
    // 저장 못 해도 신청은 됐다
  }
}

const optionLabel = (v: RestockVariant) => (v.title === "Default Title" ? "Default" : v.title);

export function RestockDialog({
  product,
  defaultVariantId,
  open,
  onOpenChange,
  onDone,
}: {
  product: RestockProduct;
  defaultVariantId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState(() => user?.shopifyEmail || user?.email || "");
  const [website, setWebsite] = useState(""); // 봇용 숨김 칸
  const [picked, setPicked] = useState<string[]>(() =>
    defaultVariantId ? [defaultVariantId] : product.soldOutVariants.length === 1 ? [product.soldOutVariants[0].id] : [],
  );
  const [submitting, setSubmitting] = useState(false);
  const showPicker = !defaultVariantId && product.soldOutVariants.length > 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (picked.length === 0) {
      toast.error("Please choose at least one option.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), handle: product.handle, variantIds: picked, website }),
      });
      if (!res.ok) throw new Error(String(res.status));
      rememberRequested(picked);
      toast.success("We'll email you when it's back in stock.");
      onDone();
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notify me when available</DialogTitle>
          <DialogDescription className="line-clamp-2">{product.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {showPicker && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Sold-out options</p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {product.soldOutVariants.map((v) => (
                  <label key={v.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={picked.includes(v.id)}
                      onCheckedChange={(c) =>
                        setPicked((p) => (c ? [...p, v.id] : p.filter((id) => id !== v.id)))
                      }
                    />
                    {optionLabel(v)}
                  </label>
                ))}
              </div>
            </div>
          )}
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          <p className="text-xs text-muted-foreground">
            We'll send you a one-time email when this item is back in stock.
          </p>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Notify me
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 목록 카드 — 품절 오버레이 안. 카드 전체 클릭(상품 이동)으로 새지 않게 막는다 */
export function RestockCardButton({ product }: { product: RestockProduct }) {
  const [open, setOpen] = useState(false);
  // 품절 옵션을 전부 신청했을 때만 「Requested」
  const allRequested = () => {
    const done = readRequested();
    return product.soldOutVariants.length > 0 && product.soldOutVariants.every((v) => done.includes(v.id));
  };
  const [requested, setRequested] = useState(allRequested);
  if (product.soldOutVariants.length === 0) return null;

  // 다이얼로그는 포털이지만 React 이벤트는 카드로 올라간다 — 감싼 span 에서 전부 막는다
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm whitespace-nowrap",
          requested ? "bg-white text-emerald-600 border border-emerald-500" : "bg-emerald-500 text-white hover:bg-emerald-600",
        )}
      >
        {requested ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        {requested ? "Requested" : "Notify me"}
      </button>
      {open && (
        <RestockDialog product={product} open={open} onOpenChange={setOpen} onDone={() => setRequested(allRequested())} />
      )}
    </span>
  );
}

/** 상품 상세 하단 — 고른 옵션이 품절일 때 장바구니·구매 버튼 자리 */
export function RestockDetailButton({ product, variant }: { product: RestockProduct; variant: RestockVariant }) {
  const [open, setOpen] = useState(false);
  const [requestedIds, setRequestedIds] = useState(readRequested);
  const requested = requestedIds.includes(variant.id);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant={requested ? "outline" : "default"}
        className={cn(
          "flex-1 h-12 font-semibold",
          requested ? "border-emerald-500 text-emerald-600" : "bg-emerald-500 text-white hover:bg-emerald-600",
        )}
      >
        {requested ? <BellRing className="h-5 w-5 mr-2" /> : <Bell className="h-5 w-5 mr-2" />}
        {requested ? "Restock alert requested" : "Notify me when available"}
      </Button>
      {open && (
        <RestockDialog
          key={variant.id}
          product={product}
          defaultVariantId={variant.id}
          open={open}
          onOpenChange={setOpen}
          onDone={() => setRequestedIds(readRequested())}
        />
      )}
    </>
  );
}
