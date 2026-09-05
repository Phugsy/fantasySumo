import type { ActiveView } from "../types";
import "./PageHeader.css";

interface PageHeaderProps {
  activeView: ActiveView;
}

const pageCopy: Record<
  ActiveView,
  { eyebrow: string; title: string; description: string }
> = {
  home: {
    eyebrow: "Current basho",
    title: "Follow the leaderboard",
    description:
      "See the current tournament and track every stable as results are recorded.",
  },
  history: {
    eyebrow: "Across tournaments",
    title: "Basho history",
    description:
      "Review past tournaments, cumulative standings, and your rikishi records over time.",
  },
  login: {
    eyebrow: "Player account",
    title: "Log in or join",
    description:
      "Sign in to create your basho team, manage your picks, and follow your stable.",
  },
  "reset-password": {
    eyebrow: "Player account",
    title: "Reset your password",
    description:
      "Request a secure reset link or choose a new password from the link in your email.",
  },
  stable: {
    eyebrow: "Your basho team",
    title: "My stable",
    description:
      "See your line-up, pick status, and scoring progress in one place.",
  },
  team: {
    eyebrow: "Current basho",
    title: "Build your basho team",
    description:
      "Choose your rikishi from the current banzuke and join the standings.",
  },
  admin: {
    eyebrow: "Basho operations",
    title: "Admin controls",
    description:
      "Manage explicit lifecycle transitions and the isolated demo testing loop.",
  },
};

export function PageHeader({ activeView }: PageHeaderProps) {
  const copy = pageCopy[activeView];

  return (
    <section className="page-header" aria-labelledby="page-title">
      <p className="eyebrow">{copy.eyebrow}</p>
      <div>
        <h1 id="page-title" tabIndex={-1}>
          {copy.title}
        </h1>
        <p className="lede">{copy.description}</p>
      </div>
    </section>
  );
}
