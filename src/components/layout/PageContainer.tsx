import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

// Shared content-area spec for GNB subpages (Blog, Pop-up, ...) so their left/right
// edges and max-width line up regardless of what each page renders inside.
export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn("max-w-4xl mx-auto px-4", className)}>{children}</div>;
}
