import type { ActiveView } from "../types";
import "./PageHeader.css";

interface PageHeaderProps {
  activeView: ActiveView;
}

const pageCopy: Record<
  ActiveView,
  { eyebrow: string; title: string; description: string }
> = {
  stable: {
    eyebrow: "Your basho team",
    title: "My stable",
    description:
      "See your line-up, pick status, and scoring progress in one place.",
  },
  selection: {
    eyebrow: "Current basho",
    title: "Build your basho team",
    description:
      "Choose your rikishi from the current banzuke and join the standings.",
  },
  leaderboard: {
    eyebrow: "Basho standings",
    title: "Follow the leaderboard",
    description:
      "Track each stable's score as results are recorded through the tournament.",
  },
};

export function PageHeader({ activeView }: PageHeaderProps) {
  const copy = pageCopy[activeView];

  return (
    <section className="page-header" aria-labelledby="page-title">
      <p className="eyebrow">{copy.eyebrow}</p>
      <div>
        <h1 id="page-title">{copy.title}</h1>
        <p className="lede">{copy.description}</p>
      </div>
    </section>
  );
}
