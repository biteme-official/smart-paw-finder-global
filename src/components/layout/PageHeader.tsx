import type { ReactNode } from "react";
import { PageContainer } from "./PageContainer";

interface PageHeaderProps {
  title: ReactNode;
  description: ReactNode;
}

// Shared top-of-page header (title + description) for GNB subpages (Blog, Pop-up,
// About Us, ...) so they always render with the exact same style going forward —
// change the spec here once and every page using it stays in sync.
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <section>
      <PageContainer className="pt-12 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground uppercase">
          {title}
        </h1>
        {/* Same text-muted-foreground token as elsewhere (e.g. About's "four values" line) —
            font-semibold at this size made the identical color read as noticeably darker,
            so this stays regular weight to actually look like that lighter warm gray. */}
        <p className="mt-8 max-w-xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>
      </PageContainer>
    </section>
  );
}
