import { useEffect, useState } from "react";
import {
  fetchEvalRuns, fetchBenchmarks, fetchApprovals, decideApproval,
  EvalRun, BenchmarkRow, Approval,
} from "../api";

function usePoll<T>(fn: () => Promise<T>, ms: number, dep = 0): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    const tick = () => fn().then(d => live && setData(d)).catch(() => {});
    tick();
    const t = setInterval(tick, ms);
    return () => { live = false; clearInterval(t); };
  }, [dep]);
  return data;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-steel">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center font-mono text-xs text-dim">{label}</p>;
}

/* Score bar: value 0-1 → width + color band (fail<0.6<ok<0.85<strong) */
function scoreColor(v: number) {
  return v >= 0.85 ? "bg-okc" : v >= 0.6 ? "bg-tally" : "bg-fail";
}
function ScoreBar({ v }: { v: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-line">
      <div className={`h-1.5 rounded-full ${scoreColor(v)}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

/* ── Eval reports: prompt regression history ── */
function EvalPanel() {
  const runs = usePoll(fetchEvalRuns, 8000);
  if (!runs) return <Empty label="Loading eval runs…" />;
  if (runs.length === 0)
    return <Empty label="No evaluations yet. Run content_core.eval.evaluate() to populate." />;
  return (
    <ul className="divide-y divide-line">
      {runs.map((r: EvalRun) => (
        <li key={r.id} className="py-2">
          <div className="flex items-baseline gap-2">
            <span className="font-medium">{r.prompt}</span>
            {r.version != null && <span className="font-mono text-[10px] text-dim">v{r.version}</span>}
            <span className="font-mono text-[10px] text-dim">{r.model}</span>
            <span className="ml-auto font-mono text-xs text-ink">{(r.mean_score * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-1"><ScoreBar v={r.mean_score} /></div>
          <p className="mt-0.5 font-mono text-[10px] text-dim">
            pass rate {(r.pass_rate * 100).toFixed(0)}% · {new Date(r.at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ── Benchmark: model comparison, grouped, best score highlighted ── */
function BenchmarkPanel() {
  const rows = usePoll(fetchBenchmarks, 8000);
  if (!rows) return <Empty label="Loading benchmarks…" />;
  if (rows.length === 0)
    return <Empty label="No benchmarks yet. Run content_core.eval.benchmark() to compare models." />;
  const best = Math.max(...rows.map((r: BenchmarkRow) => r.score), 0.0001);
  return (
    <ul className="space-y-2">
      {rows.map((r: BenchmarkRow) => (
        <li key={r.id}>
          <div className="flex justify-between font-mono text-xs">
            <span className={r.score === best ? "text-tally" : "text-ink"}>
              {r.model}<span className="ml-1 text-dim">/{r.provider}</span>
            </span>
            <span className="text-dim">{(r.score * 100).toFixed(0)}% · {r.latency_s}s</span>
          </div>
          <div className="mt-1"><ScoreBar v={r.score} /></div>
        </li>
      ))}
    </ul>
  );
}

/* ── Approval queue: HITL, approve/reject inline ── */
function ApprovalPanel() {
  const [nonce, setNonce] = useState(0);
  const items = usePoll(fetchApprovals, 5000, nonce);
  const [busy, setBusy] = useState<number | null>(null);

  async function act(id: number, approved: boolean) {
    setBusy(id);
    try { await decideApproval(id, approved); setNonce(n => n + 1); }
    finally { setBusy(null); }
  }

  if (!items) return <Empty label="Loading approvals…" />;
  if (items.length === 0)
    return <Empty label="Nothing awaiting review. Auto-approved items skip this queue." />;
  return (
    <ul className="space-y-2">
      {items.map((a: Approval) => (
        <li key={a.id} className="rounded border border-line p-2">
          <div className="flex items-baseline gap-2">
            <span className="font-medium truncate">{a.summary ?? a.item_ref}</span>
            {a.score != null && (
              <span className={`ml-auto font-mono text-xs ${scoreColor(a.score).replace("bg-", "text-")}`}>
                {(a.score * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-dim">{a.workflow} · {a.item_ref}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => act(a.id, true)} disabled={busy === a.id}
              className="rounded bg-okc/15 px-3 py-1 font-mono text-xs text-okc hover:bg-okc/25 disabled:opacity-50"
            >Approve</button>
            <button
              onClick={() => act(a.id, false)} disabled={busy === a.id}
              className="rounded bg-fail/15 px-3 py-1 font-mono text-xs text-fail hover:bg-fail/25 disabled:opacity-50"
            >Reject</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function QualityView() {
  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-6 lg:grid-cols-2">
      <Panel title="Prompt evaluations"><EvalPanel /></Panel>
      <Panel title="Model benchmarks"><BenchmarkPanel /></Panel>
      <div className="lg:col-span-2">
        <Panel title="Approval queue — human review"><ApprovalPanel /></Panel>
      </div>
    </main>
  );
}
