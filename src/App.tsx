import { useEffect, useState } from "react";
import { fetchHealth, Health } from "./api";
import OperationsView, { HealthBadge } from "./views/OperationsView";
import QualityView from "./views/QualityView";

type Tab = "operations" | "quality";

export default function App() {
  const [tab, setTab] = useState<Tab>("operations");
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let live = true;
    const tick = () => fetchHealth().then(h => live && setHealth(h)).catch(() => {});
    tick();
    const t = setInterval(tick, 10000);
    return () => { live = false; clearInterval(t); };
  }, []);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line px-6 py-4 flex items-center gap-6">
        <h1 className="font-display text-lg font-bold tracking-tight">
          content platform<span className="text-tally">.</span>
        </h1>
        <nav className="flex gap-1 font-mono text-xs">
          {(["operations", "quality"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 transition-colors ${
                tab === t ? "bg-line text-ink" : "text-dim hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="ml-auto"><HealthBadge health={health} /></div>
      </header>

      {tab === "operations" ? <OperationsView /> : <QualityView />}
    </div>
  );
}
