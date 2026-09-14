"use client";

/**
 * The client side of the one metrics layer.
 *
 * Every tab reads its business numbers through this hook, from
 * /api/admin/metrics, and never computes them. The date range is shared too:
 * choosing "30 days" on one tab moves every tab, so Today, Pipeline and
 * Analytics always show the same window — two tabs on different windows was
 * half of why the same business looked like two different ones.
 */
import { useCallback, useEffect, useState } from "react";
import type { Summary, ChecklistSummary } from "@/lib/metrics";

export type MetricsPayload = {
  days: number;
  summary: Summary;
  month: { revenue: number; won: number };
  allTime: { won: number; attended: number; revenue: number };
  checklist: ChecklistSummary;
  sources: { leadRows: number; bookings: number; calls: number; bookingsError: string; loadedAt: string };
  generatedAt: string;
};

const RANGE_STORE = "admin_range_days";
const RANGE_EVENT = "admin-range-changed";
export const RANGE_CHOICES = [7, 14, 30, 90, 0] as const;
export const rangeLabel = (d: number) => (d === 0 ? "All" : `${d}d`);

function readRange(): number {
  try {
    const v = Number(localStorage.getItem(RANGE_STORE));
    return (RANGE_CHOICES as readonly number[]).includes(v) ? v : 14;
  } catch {
    return 14;
  }
}

/** The shared date range. Setting it on any tab updates all of them. */
export function useRange(): [number, (d: number) => void] {
  const [days, setDays] = useState(14);
  useEffect(() => {
    const sync = () => setDays(readRange());
    sync();
    window.addEventListener(RANGE_EVENT, sync);
    return () => window.removeEventListener(RANGE_EVENT, sync);
  }, []);
  const set = useCallback((d: number) => {
    try {
      localStorage.setItem(RANGE_STORE, String(d));
    } catch {
      /* storage blocked: this tab still moves */
    }
    setDays(d);
    window.dispatchEvent(new Event(RANGE_EVENT));
  }, []);
  return [days, set];
}

export function useMetrics(adminKey: string | null, days: number) {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (fresh = false) => {
    if (!adminKey) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/metrics?days=${days}${fresh ? "&fresh=1" : ""}`, {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `metrics ${res.status}`);
      setData(json as MetricsPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [adminKey, days]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { data, error, loading, reload: load };
}

export const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
export const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
