import type { ComponentProps } from "react";
import { RikishiPhoto } from "./RikishiPhoto";
import * as styles from "./RankBadge.css";

export function RankBadge({
  rank,
  overlay = false,
}: {
  rank: string;
  overlay?: boolean;
}) {
  const compact = rank
    .replace("Yokozuna", "Y")
    .replace("Ozeki", "O")
    .replace("Sekiwake", "S")
    .replace("Komusubi", "K")
    .replace(/Maegashira\s*#?/, "M");
  return (
    <span
      className={`rank-pill ${styles.badge} ${overlay ? styles.overlayBadge : styles.inlineBadge}`}
      aria-label={rank}
      title={rank}
    >
      <span className={styles.full}>{rank}</span>
      <span className={styles.compact} aria-hidden="true">
        {compact}
      </span>
    </span>
  );
}

export function RankedPortrait({
  rank,
  ...props
}: ComponentProps<typeof RikishiPhoto> & { rank: string }) {
  return (
    <span className={styles.portrait}>
      <RikishiPhoto {...props} />
      <span className={styles.overlay}>
        <RankBadge rank={rank} overlay />
      </span>
    </span>
  );
}
