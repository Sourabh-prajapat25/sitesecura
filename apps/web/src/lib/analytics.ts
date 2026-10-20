import { api } from "./api";
import { ContentAnalyticsEventCreate } from "@/types";

/**
 * Non-blocking client-side telemetry tracker for content engagement.
 * Employs navigator.sendBeacon when available with safe fallback to api.recordContentAnalyticsEvent.
 * Guarantees zero disruption to UX and adheres to strict privacy constraints.
 */
export function trackContentEvent(event: ContentAnalyticsEventCreate): void {
  if (typeof window === "undefined") return;

  const payload: ContentAnalyticsEventCreate = {
    ...event,
    path: event.path || window.location.pathname,
    referrer: event.referrer !== undefined ? event.referrer : (document.referrer || undefined),
  };

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
    const endpoint = `${apiUrl}/analytics/events`;

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (!sent) {
        api.recordContentAnalyticsEvent(payload).catch(() => {});
      }
    } else {
      api.recordContentAnalyticsEvent(payload).catch(() => {});
    }
  } catch {
    // Non-blocking: fail silently
  }
}
