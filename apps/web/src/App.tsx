import { foundationLabel } from "@fantasy-sumo/domain";

export function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Basho-ready foundation</p>
        <h1 id="page-title">Fantasy Sumo</h1>
        <p className="lede">
          A clean TypeScript web app foundation for building the first playable
          fantasy sumo MVP.
        </p>
        <dl className="status-grid" aria-label="Foundation status">
          <div>
            <dt>Web</dt>
            <dd>Vite + React</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>Fastify</dd>
          </div>
          <div>
            <dt>Package</dt>
            <dd>{foundationLabel}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
