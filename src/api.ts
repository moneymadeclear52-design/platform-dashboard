// api.ts — typed client for the Content Platform API.
// The Vite dev server proxies /api → http://localhost:8000 (see vite.config.ts).
// Set VITE_API_KEY when the backend has PLATFORM_API_KEY enabled.

const BASE = "/api";
const KEY = import.meta.env.VITE_API_KEY as string | undefined;

function headers(): HeadersInit {
  return KEY ? { "X-API-Key": KEY } : {};
}

export interface StepRecord {
  name: string;
  status: "ok" | "skipped" | "failed";
  attempts: number;
  duration_s: number;
  error: string | null;
}

export interface WorkflowRun {
  id: number;
  workflow: string;
  started_at: string;
  aborted: boolean;
  duration_s: number;
  steps: StepRecord[];
}

export interface UsageRow {
  provider: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  avg_latency_s: number;
}

export interface Job {
  id: string;
  kind: string;
  status: "queued" | "running" | "done" | "failed";
  created_at: string;
  error: string | null;
}

export interface Health {
  status: string;
  version: string;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export const fetchHealth = () => get<Health>("/health");
export const fetchRuns = () => get<WorkflowRun[]>("/runs?limit=25");
export const fetchUsage = () => get<UsageRow[]>("/metrics/usage?days=30");
export const fetchJobs = () => get<Job[]>("/jobs");
// ── Phase 5 additions to api.ts (append these) ──────────────────────────────

export interface EvalRun {
  id: number;
  at: string;
  prompt: string;
  version: number | null;
  model: string;
  mean_score: number;
  pass_rate: number;
}

export interface BenchmarkRow {
  id: number;
  at: string;
  provider: string;
  model: string;
  score: number;
  latency_s: number;
}

export interface Approval {
  id: number;
  workflow: string;
  item_ref: string;
  summary: string | null;
  score: number | null;
  at: string;
}

export const fetchEvalRuns = () => get<EvalRun[]>("/eval/runs?limit=20");
export const fetchBenchmarks = () => get<BenchmarkRow[]>("/benchmarks?limit=40");
export const fetchApprovals = () => get<Approval[]>("/approvals");

export async function decideApproval(id: number, approved: boolean, note?: string) {
  const r = await fetch(`${BASE}/approvals/${id}/decide`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ approved, note }),
  });
  if (!r.ok) throw new Error(`decide → ${r.status}`);
  return r.json();
}

// ── Phase 6: feedback ────────────────────────────────────────────────────────
export interface CategoryBoost {
  category: string;
  boost: number;
  sample_size: number;
  avg_performance: number;
}
export const fetchFeedback = (channel: string) =>
  get<CategoryBoost[]>(`/feedback/${encodeURIComponent(channel)}`);
