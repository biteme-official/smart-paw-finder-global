import { useNavigate } from "react-router-dom";
import { PartyPopper } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAffiliateApply } from "@/components/affiliate/useAffiliateApply";
import { AffiliatePageDesktop } from "@/components/affiliate/AffiliatePageDesktop";

// PC/모바일 분리 구조: 이 셸이 공용 폼 상태(useAffiliateApply)와 완료 팝업을
// 소유하고, 뷰포트별 본문 컴포넌트에 주입한다. 현재 브랜치는 데스크톱만 —
// 모바일 본문(AffiliatePageMobile)은 별도 PR에서 추가한다.
export default function Affiliate() {
  const navigate = useNavigate();
  const apply = useAffiliateApply();

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={handleSearch} />

      <main className="flex-1">
        <AffiliatePageDesktop apply={apply} />
      </main>

      <Footer />

      <Dialog open={apply.submitted} onOpenChange={(open) => !open && apply.setSubmitted(false)}>
        <DialogContent className="max-w-[340px] rounded-3xl border-none p-8 text-center sm:max-w-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <PartyPopper className="h-7 w-7 text-orange-600" strokeWidth={1.75} />
          </div>
          <DialogTitle className="mt-4 text-center text-lg font-bold text-foreground">
            Application Submitted! 🎉
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 space-y-2 text-center text-sm text-muted-foreground leading-relaxed">
              <p>
                You'll receive your affiliate invitation
                <br />
                email by tomorrow.
              </p>
              <p>
                Follow the instructions in the email
                <br />
                to get started!
              </p>
            </div>
          </DialogDescription>
          <Button onClick={() => navigate("/")} className="mt-6 w-full font-semibold">
            Continue Shopping
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
