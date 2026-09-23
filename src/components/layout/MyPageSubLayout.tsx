import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

interface MyPageSubLayoutProps {
  title: ReactNode;
  onBack: () => void;
  children: ReactNode;
  /** Extra classes for the content area (e.g. vertical spacing between cards). */
  className?: string;
}

// Shared shell for every My Page sub page (Order History, Affiliate, All links,
// Commission history, ...): sticky header with back button + centered title and a
// bottom divider, over the same narrow centered content column. Change the spec
// here once and every sub page stays in sync.
export function MyPageSubLayout({ title, onBack, children, className }: MyPageSubLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <header className="sticky top-[57px] z-40 bg-background border-b border-border">
        <div className="max-w-md mx-auto flex items-center px-4 h-12">
          <button onClick={onBack} className="p-2 -ml-2" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-sm truncate">{title}</h1>
          {/* Mirrors the back button's width so the title stays truly centered. */}
          <div className="w-9" />
        </div>
      </header>
      <main className={cn("max-w-md mx-auto px-4 py-6 pb-24", className)}>{children}</main>
    </div>
  );
}
