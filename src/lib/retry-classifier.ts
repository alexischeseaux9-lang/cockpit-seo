// Classe une erreur de job et decide de la suite (interface V2 action-based).

export type RetryDecision =
  | { action: "retry"; delay_seconds: number }
  | { action: "pause_site"; reason: string }
  | { action: "pause_job"; reason: string }
  | { action: "fail"; reason: string };

export function classifyError(error: string, attempts: number): RetryDecision {
  if (/credit_balance|insufficient_credits|insufficient|402/i.test(error)) {
    return { action: "pause_site", reason: "anthropic_credits_exhausted" };
  }
  if (/rate_limit|rate limit|too many|429/i.test(error)) {
    const delay = Math.min(60 * 2 ** attempts, 600);
    return { action: "retry", delay_seconds: delay };
  }
  if (/ECONNRESET|ETIMEDOUT|fetch failed|network|ENOTFOUND|timeout/i.test(error)) {
    return attempts < 3
      ? { action: "retry", delay_seconds: 30 * (attempts + 1) }
      : { action: "fail", reason: "network_persistent" };
  }
  if (/validation|invalid input|anti_patterns|persona_leak|json_parse|missing_keyword/i.test(error)) {
    return { action: "fail", reason: "validation_error" };
  }
  if (/route_not_resolved/i.test(error)) {
    return { action: "pause_job", reason: "route_404_check_taxonomy" };
  }
  return attempts < 5 ? { action: "retry", delay_seconds: 60 } : { action: "fail", reason: "unknown_persistent" };
}
