import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import {
  LEARN_ARTICLES,
  LEARN_CATEGORIES,
  LEARN_INTRO,
  type LearnArticle,
  type LearnSection,
  getLearnArticle,
} from "../lib/learnContent";
import { BRAND } from "../lib/brand";

type Props = {
  /** Deep-link article id from parent (optional) */
  initialArticleId?: string | null;
  onOpenPlayer?: () => void;
};

function SectionBlock({ section }: { section: LearnSection }) {
  switch (section.type) {
    case "p":
      return <p className="learn-p">{section.text}</p>;
    case "h3":
      return <h3 className="learn-h3">{section.text}</h3>;
    case "ul":
      return (
        <ul className="learn-ul">
          {section.items.map((item) => (
            <li key={item.slice(0, 48)}>{item}</li>
          ))}
        </ul>
      );
    case "formula":
      return (
        <div className="learn-formula">
          <span className="learn-formula-label">{section.label}</span>
          <code>{section.value}</code>
        </div>
      );
    case "callout":
      return (
        <aside className={`learn-callout ${section.tone}`}>
          <strong>{section.title}</strong>
          <p>{section.text}</p>
        </aside>
      );
    default:
      return null;
  }
}

function ArticleReader({
  article,
  onBack,
  onOpenPlayer,
}: {
  article: LearnArticle;
  onBack: () => void;
  onOpenPlayer?: () => void;
}) {
  return (
    <article className="learn-article">
      <button type="button" className="learn-back" onClick={onBack}>
        <ArrowLeft size={16} />
        All topics
      </button>
      <header className="learn-article-head">
        <span className="learn-cat">{article.category}</span>
        <h2>{article.title}</h2>
        <p className="learn-article-sum">{article.summary}</p>
        <span className="learn-mins">
          <Clock size={13} /> {article.minutes} min read
        </span>
      </header>
      <div className="learn-article-body">
        {article.sections.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}
      </div>
      <footer className="learn-article-foot">
        <p>
          Powered by <strong>{BRAND.techMark}</strong> · {BRAND.product}
        </p>
        {onOpenPlayer && (
          <button type="button" className="btn primary sm" onClick={onOpenPlayer}>
            Try it in the Player
          </button>
        )}
      </footer>
    </article>
  );
}

export function LearnView({ initialArticleId = null, onOpenPlayer }: Props) {
  const [articleId, setArticleId] = useState<string | null>(
    initialArticleId,
  );
  const [filter, setFilter] = useState<string>("All");

  const article = articleId ? getLearnArticle(articleId) : null;

  const list = useMemo(() => {
    if (filter === "All") return LEARN_ARTICLES;
    return LEARN_ARTICLES.filter((a) => a.category === filter);
  }, [filter]);

  if (article) {
    return (
      <ArticleReader
        article={article}
        onBack={() => setArticleId(null)}
        onOpenPlayer={onOpenPlayer}
      />
    );
  }

  return (
    <div className="learn-home">
      <div className="page-toolbar">
        <div className="page-title-block">
          <h2>
            <BookOpen size={22} className="learn-title-icon" />
            {LEARN_INTRO.title}
          </h2>
          <p>{LEARN_INTRO.subtitle}</p>
        </div>
      </div>

      <div className="learn-principles">
        <div className="learn-principle">
          <ShieldCheck size={18} />
          <div>
            <strong>Honest claims</strong>
            <span>Ratio retune + exact pure tones only where generated</span>
          </div>
        </div>
        <div className="learn-principle">
          <FlaskConical size={18} />
          <div>
            <strong>Measurable tech</strong>
            <span>Cents, ratios, and verification — not miracle marketing</span>
          </div>
        </div>
      </div>

      <div className="filter-row learn-filters">
        <button
          type="button"
          className={`chip ${filter === "All" ? "on" : ""}`}
          onClick={() => setFilter("All")}
        >
          All
        </button>
        {LEARN_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${filter === c ? "on" : ""}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <ul className="learn-list">
        {list.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className="learn-card"
              onClick={() => setArticleId(a.id)}
            >
              <span className="learn-card-cat">{a.category}</span>
              <span className="learn-card-title">{a.title}</span>
              <span className="learn-card-sum">{a.summary}</span>
              <span className="learn-card-meta">
                <Clock size={12} /> {a.minutes} min
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="learn-disclaimer">
        Educational content only. {BRAND.product} is not a medical device and
        does not diagnose, treat, or cure any condition. Prefer primary sources
        when evaluating published studies.
      </p>
    </div>
  );
}
