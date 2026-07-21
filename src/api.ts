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
