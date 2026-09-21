import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { blogPosts, getAllCategories } from "@/data/blog/posts";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BlogList() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = getAllCategories();

  const filtered = selectedCategory
    ? blogPosts.filter((p) => p.category === selectedCategory)
    : blogPosts;

  return (
    <div className="bg-background min-h-screen">
      <Header />

      <main>
      <PageHeader
        title={<>LEARN MORE<br />ABOUT YOUR PET</>}
        description={
          <>
            Discover helpful tips and insights{' '}
            <br className="hidden md:inline" />
            for a happier, healthier life with your pet.
          </>
        }
      />

      <section>
      <PageContainer className="pb-24">
        <div className="flex flex-wrap justify-center gap-2 mb-8 md:flex-nowrap md:justify-start md:overflow-x-auto md:pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2">
            {filtered.map((post, i) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group block"
              >
                <article className="bg-card border border-border overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                  <div className="aspect-[4/3] overflow-hidden bg-secondary">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading={i === 0 ? "eager" : "lazy"}
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {post.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readingTime} min
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                      {post.title}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1.5 line-clamp-2 flex-1">
                      {post.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-3">
                      Read more <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            No posts in this category yet.
          </div>
        )}
      </PageContainer>
      </section>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
