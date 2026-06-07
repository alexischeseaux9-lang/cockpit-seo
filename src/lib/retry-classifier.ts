// Classe une erreur de job et decide de la suite (cf. section 6.4 du master prompt).

export type RetryClass =
  | "credits_exhausted"
  | "rate_limited"
  | "network"
  | "validation"
  | "route_not_resolved"
  | "unknown";

export type RetryDecision = {
  class: RetryClass;
  retry: boolean;
  delayMs: number; // 0 si pas de retry
  pauseSite: boolean;
  alert: boolean;
};

export function classifyError(message: string, attempts: number): RetryDecision {
  const m = (message || "").toLowerCase();

  // Anthropic credits / 402
  if (m.includes("402") || m.includes("credit") || m.includes("insufficient")) {
    return { class: "credits_exhausted", retry: false, delayMs: 0, pauseSite: true, alert: true };
  }
  // Rate limit / 429
  if (m.includes("429") || m.includes("rate") || m.includes("too many")) {
    const backoff = [60_000, 120_000, 240_000];
    const idx = Math.min(attempts, backoff.length - 1);
    return { class: "rate_limited", retry: attempts < 3, delayMs: backoff[idx], pauseSite: false, alert: false };
  }
  // Reseau
  if (
    m.includes("econnreset") ||
    m.includes("timeout") ||
    m.includes("etimedout") ||
    m.includes("fetch failed") ||
    m.includes("network") ||
    m.includes("enotfound")
  ) {
    return { class: "network", retry: attempts < 3, delayMs: 30_000, pauseSite: false, alert: false };
  }
  // Validation (zod, anti-pattern, persona, json parse)
  if (
    m.includes("anti_patterns") ||
    m.includes("persona_leak") ||
    m.includes("json_parse") ||
    m.includes("missing_keyword") ||
    m.includes("validation")
  ) {
    return { class: "validation", retry: false, delayMs: 0, pauseSite: false, alert: false };
  }
  // URL non resolue apres publish
  if (m.includes("route_not_resolved")) {
    return { class: "route_not_resolved", retry: false, delayMs: 0, pauseSite: false, alert: true };
  }
  return { class: "unknown", retry: false, delayMs: 0, pauseSite: false, alert: false };
}
