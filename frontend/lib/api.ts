import { isSavedRun } from "@/lib/contracts";
import type { DiscoveryRequest, SavedRun, StageEvent } from "@/lib/contracts";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function checkApi(): Promise<void> {
  const response = await fetch(`${API_URL}/health`, {
    cache: "no-store",
    signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) throw new Error(`Backend health check failed (${response.status}).`);
}

export async function getSavedRun(demoId?: string): Promise<SavedRun | null> {
  const path = demoId ? `/saved-run/${encodeURIComponent(demoId)}` : "/saved-run";
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(65_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Saved run could not be loaded (${response.status}).`);
  const savedRun: unknown = await response.json();
  if (!isSavedRun(savedRun)) throw new Error("The configured saved run is invalid.");
  return savedRun;
}

export async function analyze(
  request: DiscoveryRequest,
  onEvent: (event: StageEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const validationDetails =
      body &&
      Array.isArray(body.details) &&
      body.details.every(
        (item: unknown) =>
          typeof item === "object" &&
          item !== null &&
          "message" in item &&
          typeof item.message === "string",
      )
        ? body.details.map((item: { message: string }) => item.message).join(" ")
        : "";
    const message =
      body && typeof body.message === "string"
        ? body.message
        : validationDetails
          ? `The backend rejected the brief: ${validationDetails}`
        : body && typeof body.error === "string"
          ? body.error
          : `Analysis request failed (${response.status}).`;
    throw new Error(message);
  }
  if (!response.body) throw new Error("The backend did not open an analysis stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) continue;
        const event = JSON.parse(data) as StageEvent;
        onEvent(event);
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const data = buffer
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as StageEvent);
    }
  } finally {
    reader.releaseLock();
  }
}
