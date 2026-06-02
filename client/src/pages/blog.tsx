import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ArrowUpRight, PlusCircle, ArrowUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/layout/public-layout";

export default function BlogPage() {
  const [, setLocation] = useLocation();
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: apiBlogs = [], isLoading } = useQuery<{ id: string; title: string; description: string; category: string; }[]>({
    queryKey: ["/api/blogs"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const displayBlogs = apiBlogs.slice(0, 6);
  const showEmpty = !isLoading && apiBlogs.length === 0;

  if (isLoading) {
    return (
      <PublicLayout showFooter={false}>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </PublicLayout>
    );
  }

  if (showEmpty) {
    return (
      <PublicLayout showFooter={false}>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-16 bg-background">
          <img
            src="/blog-empty.png"
            alt="No articles yet"
            className="w-full max-w-[598px] object-contain mb-8"
            style={{ maxHeight: "447px" }}
          />
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3 text-center">
            No Articles Yet
          </h2>
          <p className="text-muted-foreground text-sm md:text-base text-center max-w-md">
            We're busy preparing insightful content. Check back soon for new articles and wellness tips.
          </p>
          <button
            onClick={() => setLocation("/blog/new")}
            className="mt-6 flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-primary/90 transition-colors"
          >
            Add New Blog <PlusCircle className="h-4 w-4" />
          </button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-12 md:py-16 bg-background text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-3">
            Blog
          </h1>
          <p className="text-foreground text-base md:text-lg font-medium">
            Wellness Insights &amp; Ayurvedic Wisdom.
          </p>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="pb-16 bg-background">
        <div className="container mx-auto px-8 md:px-16 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayBlogs.map((post) => (
              <div
                key={post.id}
                className="bg-primary/10 border border-primary/40 rounded-2xl p-6 flex flex-col min-h-[360px]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <img
                      src={post.category === "Therapy" ? "/therapy-icon.png" : "/consultation-icon.png"}
                      alt={post.category}
                      className="w-5 h-5 object-contain"
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">{post.category}</span>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-3">{post.title}</h3>

                <p className="text-sm text-muted-foreground flex-1 mb-6">{post.description}</p>

                <div className="mt-auto">
                  <Link href={`/blog/${post.id}`}>
                    <button className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 hover:bg-primary/90 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] group">
                      Learn More
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setLocation("/blog/new")}
              className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2 rounded-full transition-all duration-200 hover:bg-primary/90 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
            >
              Add New Blog
              <PlusCircle className="h-5 w-5 text-white" strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
        className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl hover:brightness-110 ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </PublicLayout>
  );
}
