export function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="page-title">
      <p className="eyebrow">Fantasy Sumo</p>
      <div>
        <h1 id="page-title">Build your basho team</h1>
        <p className="lede">
          Pick rikishi from the current banzuke and enter a team name to join
          the local leaderboard.
        </p>
      </div>
    </section>
  );
}
