import { useEffect, useState } from "react";
import {
  fetchHealth, fetchRuns, fetchUsage, fetchJobs,
  Health, WorkflowRun, UsageRow, Job, StepRecord,
} from "./api";

/* ── Polling hook ──────────────────────────────────────────────────────────── */

function usePoll<T>(fn: () => Promise<T>, ms: number): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    const tick = () => fn().then(d => live && setData(d)).catch(() => {});
    tick();
    const t = setInterval(tick, ms);
    return () => { live = false; clearInterval(t); };
  }, []);
  return data;
}

/* ── Health tally ──────────────────────────────────────────────────────────── */

function HealthBadge({ health }: { health: Health | null }) {
  const ok = health?.status === "ok";
  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-tally shadow-[0_0_8px_2px_rgba(255,180,84,0.55)]" : "bg-fail"}`}
        aria-label={ok ? "healthy" : "unreachable"}
      />
      <span className="text-dim">{ok ? `api ok · v${health!.version}` : "api unreachable"}</span>
    </div>
  );
}

/* ── Step timeline: the signature element.
      Each step renders as an NLE-style clip whose width = share of run
      duration and color = status. Width and color both carry information. ── */

const STATUS_BG: Record<StepRecord["status"], string> = {
  ok: "bg-okc/80",
  skipped: "bg-steel/50",
  failed: "bg-fail/80",
};

function StepTimeline({ run }: { run: WorkflowRun }) {
  const total = Math.max(run.steps.reduce((a, s) => a + s.duration_s, 0), 0.001);
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-sm border border-line">
        {run.steps.map(s => (
          <div
            key={s.name}
            title={`${s.name} · ${s.status} · ${s.duration_s}s · ${s.attempts} attempt(s)${s.error ? ` · ${s.error}` : ""}`}
            style={{ width: `${Math.max((s.duration_s / total) * 100, 3)}%` }}
            className={`${STATUS_BG[s.status]} border-r border-panel last:border-r-0 relative`}
          >
            <span className="absolute inset-0 flex items-center px-1.5 font-mono text-[10px] text-ink/90 truncate">
              {s.name}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-4 font-mono text-[10px] text-dim">
        {run.steps.map(s => (
          <span key={s.name}>{s.name} {s.duration_s}s{s.attempts > 1 ? ` ×${s.attempts}` : ""}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Runs table ────────────────────────────────────────────────────────────── */

function RunsTable({ runs }: { runs: WorkflowRun[] | null }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!runs) return <Empty label="Loading runs…" />;
  if (runs.length === 0)
    return <Empty label="No workflow runs recorded yet. Run a pipeline to see it here." />;
  return (
    <ul className="divide-y divide-line">
      {runs.map(r => (
        <li key={r.id} className="py-2">
          <button
            onClick={() => setOpen(open === r.id ? null : r.id)}
            className="flex w-full items-baseline gap-3 text-left hover:text-tally transition-colors"
          >
            <span className={`h-2 w-2 shrink-0 self-center rounded-full ${r.aborted ? "bg-fail" : "bg-okc"}`} />
            <span className="font-medium">{r.workflow}</span>
            <span className="font-mono text-xs text-dim">
              {new Date(r.started_at).toLocaleString()}
            </span>
            <span className="ml-auto font-mono text-xs text-steel">{r.duration_s}s</span>
          </button>
          {open === r.id && <div className="mt-2 pl-5"><StepTimeline run={r} /></div>}
        </li>
      ))}
    </ul>
  );
}

/* ── Cost per model (bars are divs: right-sized for a handful of models) ──── */

function CostPanel({ usage }: { usage: UsageRow[] | null }) {
  if (!usage) return <Empty label="Loading usage…" />;
  if (usage.length === 0)
    return <Empty label="No LLM calls recorded in the last 30 days." />;
  const max = Math.max(...usage.map(u => u.cost_usd), 0.0001);
  const total = usage.reduce((a, u) => a + u.cost_usd, 0);
  return (
    <div className="space-y-3">
      <p className="font-mono text-2xl text-tally">${total.toFixed(2)}<span className="ml-2 text-xs text-dim">30-day spend</span></p>
      {usage.map(u => (
        <div key={`${u.provider}:${u.model}`}>
          <div className="flex justify-between font-mono text-xs">
            <span className="text-ink">{u.model}</span>
            <span className="text-dim">${u.cost_usd.toFixed(3)} · {u.calls} calls</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-line">
            <div className="h-1.5 rounded-full bg-steel" style={{ width: `${(u.cost_usd / max) * 100}%` }} />
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-dim">
            {u.input_tokens.toLocaleString()} in / {u.output_tokens.toLocaleString()} out · {u.avg_latency_s}s avg
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Jobs panel ────────────────────────────────────────────────────────────── */

const JOB_DOT: Record<Job["status"], string> = {
  queued: "bg-dim", running: "bg-tally animate-pulse", done: "bg-okc", failed: "bg-fail",
};

function JobsPanel({ jobs }: { jobs: Job[] | null }) {
  if (!jobs) return <Empty label="Loading jobs…" />;
  if (jobs.length === 0) return <Empty label="No API jobs yet. POST /jobs/script to queue one." />;
  return (
    <ul className="space-y-1.5 font-mono text-xs">
      {jobs.slice(0, 8).map(j => (
        <li key={j.id} className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${JOB_DOT[j.status]}`} />
          <span className="text-ink">{j.kind}</span>
          <span className="text-dim">{j.id}</span>
          <span className="ml-auto text-dim">{j.status}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Shared bits ───────────────────────────────────────────────────────────── */

function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center font-mono text-xs text-dim">{label}</p>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-steel">{title}</h2>
      {children}
    </section>
  );
}

/* ── App ───────────────────────────────────────────────────────────────────── */

export default function App() {
  const health = usePoll(fetchHealth, 10000);
  const runs = usePoll(fetchRuns, 5000);
  const usage = usePoll(fetchUsage, 15000);
  const jobs = usePoll(fetchJobs, 5000);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line px-6 py-4 flex items-baseline gap-4">
        <h1 className="font-display text-lg font-bold tracking-tight">
          content platform<span className="text-tally">.</span>
        </h1>
        <span className="font-mono text-xs text-dim">mission control</span>
        <div className="ml-auto"><HealthBadge health={health} /></div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 p-6 lg:grid-cols-[1fr_320px]">
        <Panel title="Workflow runs">
          <RunsTable runs={runs} />
        </Panel>
        <div className="space-y-4">
          <Panel title="LLM cost / model"><CostPanel usage={usage} /></Panel>
          <Panel title="API jobs"><JobsPanel jobs={jobs} /></Panel>
        </div>
      </main>
    </div>
  );
}
