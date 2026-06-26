import { useState, useEffect, useCallback, useRef } from "react";

export type NetworkQuality = "fast" | "normal" | "slow" | "degraded";

export interface NetworkQualityInfo {
  quality: NetworkQuality;
  latencyMs: number;
  jitterMs: number;
  sampleCount: number;
}

const SAMPLE_INTERVAL_MS = 30_000;
const WINDOW_SIZE = 5;
const FAST_THRESHOLD = 200;
const NORMAL_THRESHOLD = 800;
const SLOW_THRESHOLD = 2000;

const PROBE_URL = window.location.origin + "/health";
const PROBE_TIMEOUT_MS = 5_000;

function classifyLatency(avg: number): NetworkQuality {
  if (avg < FAST_THRESHOLD) return "fast";
  if (avg < NORMAL_THRESHOLD) return "normal";
  if (avg < SLOW_THRESHOLD) return "slow";
  return "degraded";
}

export function useNetworkQuality(options?: {
  probeUrl?: string;
  intervalMs?: number;
  enabled?: boolean;
}): NetworkQualityInfo & { refetch: () => void } {
  const {
    probeUrl = PROBE_URL,
    intervalMs = SAMPLE_INTERVAL_MS,
    enabled = true,
  } = options ?? {};

  const [quality, setQuality] = useState<NetworkQuality>("normal");
  const [latencyMs, setLatencyMs] = useState(0);
  const [jitterMs, setJitterMs] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const measure = useCallback(async () => {
    if (!enabled) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const start = performance.now();

    try {
      await fetch(probeUrl, {
        method: "HEAD",
        signal: AbortSignal.any([
          abortRef.current.signal,
          AbortSignal.timeout(PROBE_TIMEOUT_MS),
        ]),
        cache: "no-store",
      });

      const elapsed = performance.now() - start;
      const samples = samplesRef.current;

      samples.push(elapsed);
      if (samples.length > WINDOW_SIZE) samples.shift();

      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      const jitter = samples.length > 1
        ? Math.abs(samples[samples.length - 1] - samples[samples.length - 2])
        : 0;

      setLatencyMs(Math.round(avg));
      setJitterMs(Math.round(jitter));
      setSampleCount(samples.length);
      setQuality(classifyLatency(avg));
    } catch {
      const samples = samplesRef.current;
      samples.push(SLOW_THRESHOLD * 2);
      if (samples.length > WINDOW_SIZE) samples.shift();

      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      setLatencyMs(Math.round(avg));
      setQuality(classifyLatency(avg));
      setSampleCount(samples.length);
    }
  }, [enabled, probeUrl]);

  useEffect(() => {
    if (!enabled) return;
    void measure();
    const intervalId = window.setInterval(() => void measure(), intervalMs);
    return () => {
      window.clearInterval(intervalId);
      abortRef.current?.abort();
    };
  }, [measure, enabled, intervalMs]);

  return { quality, latencyMs, jitterMs, sampleCount, refetch: measure };
}

export function getAdaptiveInterval(
  baseInterval: number,
  quality: NetworkQuality,
): number {
  switch (quality) {
    case "fast":
      return baseInterval;
    case "normal":
      return baseInterval;
    case "slow":
      return Math.min(baseInterval * 2, 120_000);
    case "degraded":
      return Math.min(baseInterval * 4, 300_000);
  }
}
