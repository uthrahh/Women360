import { useEffect, useMemo, useState } from "react";
import { learnService } from "@/services/learnService";
import type { LearnArticle } from "@/types";
import { Card, CardBody } from "@/components/ui/Card";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Search } from "lucide-react";

export default function LearnPage() {
  const [articles, setArticles] = useState<LearnArticle[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [openArticle, setOpenArticle] = useState<LearnArticle | null>(null);

  useEffect(() => {
    learnService.list().then(setArticles);
  }, []);

  const categories = useMemo(() => {
    if (!articles) return [];
    return ["all", ...Array.from(new Set(articles.map((a) => a.category)))];
  }, [articles]);

  const filtered = useMemo(() => {
    if (!articles) return [];
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      const matchesCategory = category === "all" || a.category === category;
      const matchesQuery = !q || a.title.toLowerCase().includes(q) || a.dek.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [articles, query, category]);

  if (!articles) return <LoadingState label="Loading articles" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Learn</h1>
        <p className="text-[var(--w360-text-muted)] mt-1">Editorial guidance across your health, at every life stage.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--w360-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles and guides"
            className="w-full pl-10 pr-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm senior:text-lg"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3.5 py-2.5 rounded border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-sm senior:text-lg"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All topics" : c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No articles found" description="Try a different search term or topic." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((a) => (
            <button key={a.id} onClick={() => setOpenArticle(a)} className="text-left">
              <Card className="hover:border-maroon-400 dark:hover:border-maroon-600 transition-colors cursor-pointer h-full">
                <CardBody className="pt-5">
                  <Badge tone="accent">{a.category}</Badge>
                  <h3 className="font-display text-lg font-semibold mt-2 leading-snug">{a.title}</h3>
                  <p className="text-sm text-[var(--w360-text-muted)] mt-1">{a.dek}</p>
                  <p className="text-xs text-[var(--w360-text-muted)] mt-3">{a.readMins} min read</p>
                </CardBody>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!openArticle} onClose={() => setOpenArticle(null)} title={openArticle?.title ?? ""} size="lg">
        {openArticle && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge tone="accent">{openArticle.category}</Badge>
              <span className="text-xs text-[var(--w360-text-muted)]">{openArticle.readMins} min read</span>
            </div>
            <p className="text-sm text-[var(--w360-text-muted)]">{openArticle.dek}</p>
            <div className="w360-divider" />
            <p className="text-sm leading-relaxed">
              This article is part of Women360's editorial library. In the full product, this space holds the
              complete guide — written and reviewed by qualified health professionals per the platform's content
              governance standards, with plain-language explanations and links to related reading.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
