import type { Basho } from "../types";
import { getBashoLifecycleLabel } from "../lifecycle";

interface BashoPanelProps {
  basho: Basho;
  selectedCount: number;
}

export function BashoPanel({ basho, selectedCount }: BashoPanelProps) {
  const picksRemaining = Math.max(basho.teamSize - selectedCount, 0);

  return (
    <section className="basho-panel" aria-labelledby="basho-title">
      <div className="section-heading">
        <p className="eyebrow">Current basho</p>
        <h2 id="basho-title">{basho.name}</h2>
      </div>
      <p className="basho-dates">
        {formatDate(basho.startDate)} to {formatDate(basho.endDate)}
      </p>
      <p className="lifecycle-state">
        <strong>{getBashoLifecycleLabel(basho.status)}</strong>
        {basho.currentDay === undefined || basho.currentDay === 0
          ? null
          : ` - Day ${basho.currentDay}`}
      </p>
      <div className="progress-wrap" aria-label="Pick progress">
        <span>
          {selectedCount} of {basho.teamSize} selected
        </span>
        <strong>
          {picksRemaining === 0
            ? "Team full"
            : `${picksRemaining} pick${picksRemaining === 1 ? "" : "s"} left`}
        </strong>
      </div>
    </section>
  );
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    return value;
  }

  const [, year, month, day] = match;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(Number(year), Number(month) - 1, Number(day)));
}
